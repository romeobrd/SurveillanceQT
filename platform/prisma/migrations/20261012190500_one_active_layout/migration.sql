-- Une seule version active par entreprise (SPEC §4) ; l'historique des versions est conservé.
CREATE UNIQUE INDEX "Layout_one_active_per_organization" ON "Layout" ("organizationId") WHERE "isActive";
