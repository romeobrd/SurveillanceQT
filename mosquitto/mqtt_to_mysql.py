#!/usr/bin/env python3
"""
MQTT to MySQL Bridge
Runs on the broker server (200.26.16.180)
Subscribes to all topics and writes to database

Usage:
    python3 mqtt_to_mysql.py

Install dependencies:
    pip3 install paho-mqtt mysql-connector-python
"""

import json
import logging
import mysql.connector
from datetime import datetime
import paho.mqtt.client as mqtt

# Configuration
MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_USER = ""
MQTT_PASS = ""

MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_DB = "surveillance_db"
MYSQL_USER = "root"
MYSQL_PASS = ""  # Set your MySQL password

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_db_connection():
    """Create MySQL connection"""
    try:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            database=MYSQL_DB,
            user=MYSQL_USER,
            password=MYSQL_PASS
        )
        return conn
    except Exception as e:
        logger.error(f"MySQL connection failed: {e}")
        return None


def save_temperature_reading(conn, sensor_id, temperature, humidity):
    """Save temperature/humidity to database"""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO sensor_readings (sensor_id, temperature, humidity, timestamp)
               VALUES (%s, %s, %s, %s)""",
            (sensor_id, temperature, humidity, datetime.now())
        )
        conn.commit()
        logger.info(f"Saved temperature: {sensor_id} - {temperature}°C, {humidity}%")
    except Exception as e:
        logger.error(f"Failed to save temperature: {e}")


def save_smoke_reading(conn, sensor_id, smoke_level):
    """Save smoke level to database"""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO sensor_readings (sensor_id, smoke_level, timestamp)
               VALUES (%s, %s, %s)""",
            (sensor_id, smoke_level, datetime.now())
        )
        conn.commit()
        logger.info(f"Saved smoke: {sensor_id} - {smoke_level} ppm")
    except Exception as e:
        logger.error(f"Failed to save smoke: {e}")


def on_connect(client, userdata, flags, rc):
    """Callback when connected to broker"""
    if rc == 0:
        logger.info("Connected to MQTT broker")
        # Subscribe to all sensor topics
        client.subscribe("sensors/#")
        client.subscribe("rpi-001/#")
        client.subscribe("rpi-003/#")
        logger.info("Subscribed to sensor topics")
    else:
        logger.error(f"Connection failed with code {rc}")


def on_message(client, userdata, msg):
    """Callback when message received"""
    topic = msg.topic
    payload = msg.payload.decode('utf-8')
    
    logger.debug(f"Received: {topic} - {payload}")
    
    try:
        data = json.loads(payload)
        conn = get_db_connection()
        if not conn:
            return
        
        # Determine sensor ID from topic
        if "rpi-001" in topic or "temperature" in topic.lower():
            sensor_id = "rpi-001"
            temp = data.get('temperature', data.get('temp', data.get('t')))
            humidity = data.get('humidity', data.get('hum', data.get('h')))
            if temp is not None:
                save_temperature_reading(conn, sensor_id, float(temp), float(humidity or 0))
        
        elif "rpi-003" in topic or "smoke" in topic.lower():
            sensor_id = "rpi-003"
            smoke = data.get('smoke', data.get('level', data.get('value')))
            if smoke is not None:
                save_smoke_reading(conn, sensor_id, int(smoke))
        
        conn.close()
        
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON: {payload}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")


def main():
    logger.info("Starting MQTT to MySQL bridge")
    
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    if MQTT_USER and MQTT_PASS:
        client.username_pw_set(MYSQL_USER, MYSQL_PASS)
    
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        logger.info(f"Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}")
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Stopping...")
        client.disconnect()
    except Exception as e:
        logger.error(f"Error: {e}")


if __name__ == '__main__':
    main()
