// Video types offered when generating YouTube title ideas. `id` is what the
// UI/API exchange (labels are translated via i18n keys `videos.type.<id>`);
// `promptName` is the wording given to the AI.
export const VIDEO_TYPES = [
  { id: "educational", promptName: "Educativo" },
  { id: "tutorial", promptName: "Tutorial / paso a paso" },
  { id: "commercial", promptName: "Comercial / promocional" },
  { id: "review", promptName: "Reseña / review de producto" },
  { id: "entertainment", promptName: "Entretenimiento" },
  { id: "case-study", promptName: "Caso de éxito / testimonio" },
  { id: "behind-the-scenes", promptName: "Detrás de cámaras" },
  { id: "news", promptName: "Noticias / tendencias" },
  { id: "listicle", promptName: "Lista / top" },
] as const;

export type VideoTypeId = (typeof VIDEO_TYPES)[number]["id"];
