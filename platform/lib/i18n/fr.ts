// Textes d'interface centralisés (français uniquement en V1)
export const fr = {
  app: {
    name: "Gestion d'entreprise",
    description:
      "Plateforme de gestion d'entreprise avec carte isométrique des locaux",
    homeTitle: "Gestion d'entreprise",
    homeSubtitle: "Projet en cours de développement.",
    openMap: "Ouvrir la carte des locaux",
  },
  map: {
    pageTitle: "Carte des locaux",
    demoNotice: "Données de démonstration fictives",
    newLayout: "Générer de nouveaux locaux",
    seedLabel: "Seed",
    roleLabel: "Aperçu en tant que",
    roles: { admin: "Administrateur", manager: "Manager", employe: "Employé" },
    canvasLabel:
      "Carte isométrique des locaux. Flèches pour se déplacer, plus et moins pour zoomer, 0 pour recentrer.",
    zoomIn: "Zoomer",
    zoomOut: "Dézoomer",
    resetView: "Recentrer la vue",
    zoneList: "Zones",
    zoneListHint: "Cliquez sur la carte ou choisissez une zone dans la liste.",
    close: "Fermer le panneau",
    workstations: "Postes de travail",
    free: "Libre",
    occupied: "occupés",
    assets: "Matériel",
    stock: "Stock",
    stockAlert: "Sous le seuil",
    projects: "Projets des équipes",
    teams: "Équipes",
    none: "Aucun",
    quickActions: "Actions rapides",
    quickActionsSoon: "Disponible dans une prochaine phase",
    actions: {
      assignWorkstation: "Attribuer un poste",
      stockMovement: "Mouvement de stock",
      reportIssue: "Signaler une panne",
    },
    assetStates: {
      en_service: "En service",
      en_panne: "En panne",
      a_renouveler: "À renouveler",
    },
    assignmentNotice:
      "Les personnes affichées représentent l'affectation d'un poste, pas une présence réelle.",
    loading: "Chargement de la carte…",
    error: "La carte n'a pas pu être affichée (WebGL indisponible ?).",
  },
} as const;
