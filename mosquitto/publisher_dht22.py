#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publisher_dht22.py
==================
MQTT publisher running on the Raspberry Pi `ras-temp` (rpi-001).

Reads a DHT22 sensor on GPIO4 and publishes JSON every PUBLISH_INTERVAL
seconds to the secured Mosquitto broker (TLS / mTLS, port 8883).

Topics published (matching the Qt dashboard subscriptions):
    rpi-001/sensors/temperature
    rpi-001/sensors/humidity

Certificate layout expected on the Pi:
    ~/mqtt/certs/
        ca/ca.crt
        client/ras-temp.crt
        client/ras-temp.key
        scripts/publisher_dht22.py        <- this file

Run:
    python3 ~/mqtt/certs/scripts/publisher_dht22.py

Install requirements (once):
    pip3 install paho-mqtt adafruit-circuitpython-dht
    sudo apt install libgpiod2
"""

import json
import logging
import os
import signal
import socket
import ssl
import sys
import time
from datetime import datetime

import paho.mqtt.client as mqtt

# ---------------------------------------------------------------------------
#  CONFIGURATION
# ---------------------------------------------------------------------------
NODE_ID            = "rpi-001"                   # surveillance_db.raspberry_nodes.node_id
SENSOR_ID_TEMP     = "temp-001"
SENSOR_ID_HUM      = "hum-001"

BROKER_HOST        = "200.26.16.180"
BROKER_PORT        = 8883                        # TLS port
PUBLISH_INTERVAL   = 5                           # seconds between readings
KEEPALIVE          = 30                          # MQTT keep-alive

# Certificates (relative to the user's home directory)
CERTS_DIR          = os.path.expanduser("~/mqtt/certs")
CA_CERT            = os.path.join(CERTS_DIR, "ca",     "ca.crt")
CLIENT_CERT        = os.path.join(CERTS_DIR, "client", "ras-temp.crt")
CLIENT_KEY         = os.path.join(CERTS_DIR, "client", "ras-temp.key")

# DHT22 sensor pin (BCM numbering)
DHT_PIN            = 4

# Topics (must match dashboardwindow.cpp subscriptions)
TOPIC_TEMPERATURE  = f"{NODE_ID}/sensors/temperature"
TOPIC_HUMIDITY     = f"{NODE_ID}/sensors/humidity"
TOPIC_STATUS       = f"{NODE_ID}/status"          # online / offline (LWT)

# ---------------------------------------------------------------------------
#  LOGGING
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("publisher_dht22")


# ---------------------------------------------------------------------------
#  DHT22 driver  (with graceful fallback for testing without hardware)
# ---------------------------------------------------------------------------
try:
    import board
    import adafruit_dht
    _PIN_OBJ = getattr(board, f"D{DHT_PIN}")
    _DHT     = adafruit_dht.DHT22(_PIN_OBJ, use_pulseio=False)
    HARDWARE = True
    log.info("DHT22 initialized on GPIO%d", DHT_PIN)
except Exception as exc:  # noqa: BLE001
    HARDWARE = False
    log.warning("DHT22 hardware not available (%s) — using simulated values", exc)
    import random
    import math
    _sim_start = time.time()


def read_dht22():
    """Return (temperature_c, humidity_pct) or (None, None) on failure."""
    if HARDWARE:
        try:
            return float(_DHT.temperature), float(_DHT.humidity)
        except RuntimeError as exc:
            # Common with DHT22 — a transient read error, just retry next cycle
            log.debug("DHT22 transient error: %s", exc)
            return None, None
        except Exception as exc:  # noqa: BLE001
            log.error("DHT22 fatal error: %s", exc)
            return None, None
    # Simulation: sinusoidal variation so values clearly change over time
    elapsed = time.time() - _sim_start
    temp = 22.0 + 5.0 * math.sin(elapsed / 30.0) + random.uniform(-0.5, 0.5)
    hum  = 55.0 + 10.0 * math.cos(elapsed / 45.0) + random.uniform(-1.0, 1.0)
    return round(temp, 1), round(hum, 1)


# ---------------------------------------------------------------------------
#  MQTT CALLBACKS
# ---------------------------------------------------------------------------
def on_connect(client, _userdata, _flags, rc, _props=None):
    if rc == 0:
        log.info("Connected to %s:%d (TLS, mTLS) — broker OK", BROKER_HOST, BROKER_PORT)
        # Announce online status (retained)
        client.publish(TOPIC_STATUS, "online", qos=1, retain=True)
    else:
        log.error("Connection failed, rc=%s", rc)


def on_disconnect(_client, _userdata, rc, _props=None):
    log.warning("Disconnected (rc=%s) — paho will auto-reconnect", rc)


def on_publish(_client, _userdata, mid, _props=None):
    log.debug("Message %d published", mid)


# ---------------------------------------------------------------------------
#  MAIN
# ---------------------------------------------------------------------------
def build_client() -> mqtt.Client:
    # Use a stable client_id so the broker can track this Pi cleanly
    client = mqtt.Client(client_id=f"{NODE_ID}-{socket.gethostname()}",
                         protocol=mqtt.MQTTv311,
                         clean_session=True)

    # Last Will: if the Pi dies, broker publishes "offline" on the status topic
    client.will_set(TOPIC_STATUS, payload="offline", qos=1, retain=True)

    # ---------------------- TLS / mTLS ----------------------
    for path in (CA_CERT, CLIENT_CERT, CLIENT_KEY):
        if not os.path.isfile(path):
            log.error("Missing certificate file: %s", path)
            sys.exit(2)

    client.tls_set(
        ca_certs   = CA_CERT,
        certfile   = CLIENT_CERT,
        keyfile    = CLIENT_KEY,
        cert_reqs  = ssl.CERT_REQUIRED,
        tls_version= ssl.PROTOCOL_TLSv1_2,
    )
    # Set to True in production once the broker certificate's CN/SAN matches
    # the broker hostname or its IP. Keep False for IP-only test setups.
    client.tls_insecure_set(True)

    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_publish    = on_publish
    return client


def publish_loop(client: mqtt.Client) -> None:
    while True:
        t, h = read_dht22()
        ts   = datetime.utcnow().isoformat(timespec="seconds") + "Z"

        if t is not None:
            payload_temp = json.dumps({
                "sensor_id":  SENSOR_ID_TEMP,
                "node_id":    NODE_ID,
                "temperature": t,
                "unit":       "C",
                "timestamp":  ts,
            })
            client.publish(TOPIC_TEMPERATURE, payload_temp, qos=1, retain=False)
            log.info("PUB %s -> %s", TOPIC_TEMPERATURE, payload_temp)

        if h is not None:
            payload_hum = json.dumps({
                "sensor_id": SENSOR_ID_HUM,
                "node_id":   NODE_ID,
                "humidity":  h,
                "unit":      "%",
                "timestamp": ts,
            })
            client.publish(TOPIC_HUMIDITY, payload_hum, qos=1, retain=False)
            log.info("PUB %s -> %s", TOPIC_HUMIDITY, payload_hum)

        time.sleep(PUBLISH_INTERVAL)


def install_signal_handlers(client: mqtt.Client) -> None:
    def shutdown(signum, _frame):
        log.info("Signal %d received — shutting down", signum)
        try:
            client.publish(TOPIC_STATUS, "offline", qos=1, retain=True).wait_for_publish(2)
        finally:
            client.loop_stop()
            client.disconnect()
            sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)


def main() -> None:
    log.info("Starting DHT22 publisher for node %s", NODE_ID)
    client = build_client()
    install_signal_handlers(client)

    log.info("Connecting to %s:%d ...", BROKER_HOST, BROKER_PORT)
    client.connect(BROKER_HOST, BROKER_PORT, keepalive=KEEPALIVE)
    client.loop_start()

    try:
        publish_loop(client)
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
