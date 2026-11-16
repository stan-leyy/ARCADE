/* ARCADE — configuration de la base de données (Supabase).
   Ces deux valeurs sont publiques par nature : elles se trouvent dans
   Supabase > Project Settings > API. N'y mets JAMAIS la clé « service_role ». */
window.ARCADE_CONFIG = {
  supabaseUrl: 'https://uqwdspvrjzfeqmioxpgh.supabase.co',
  supabaseKey: 'sb_publishable_tbTdlCrT-E25OzUl0md3mA__61ZiQ-I', // clé « publishable »
  /* Boutique : false = pièces gardées sur l'appareil ; true = sur le serveur (exécuter d'abord supabase/shop.sql) */
  shopServer: false,
  /* Musique et bruitages : mets tes fichiers dans le dossier audio/ et liste-les ici.
     Utilise uniquement des sons dont tu as les droits (libres de droits ou achetés avec licence).
     menu : joués à tour de rôle avec 3 s de pause · fight : fond sonore des combats · hit : bruit des coups */
  audio: {
    menu: [],   // ex. ['audio/menu-1.mp3', 'audio/menu-2.mp3']
    fight: [],  // ex. ['audio/combat.mp3']
    hit: [],    // ex. ['audio/coup.mp3']
  },
};
