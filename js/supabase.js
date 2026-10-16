
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// URL DE NUESTRO PROYECTO
const SUPABASE_URL =
  "https://ytylzbndvsaabspajncc.supabase.co";

// CLAVE PUBLICA DE SUPABASE
const SUPABASE_KEY =
  "sb_publishable_yQiIfI-0fVXcuekLJFnAFQ_g5owvRI4";

// CONEXION CON LA BASE DE DATOS
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log("Cliente Supabase inicializado");
