
import { supabase } from "./supabase.js";

// TALLER LUIGI BIKER
// Botones para ver, eliminar y generar comprobantes.

const lista = document.getElementById("lista-reparaciones");

function crearBoton(texto, accion, clase = "") {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.textContent = texto;
  boton.className = clase;
  boton.addEventListener("click", accion);
  return boton;
}

async function eliminarTrabajo(id, tarjeta) {
  const confirmar = confirm(
    "¿Estás seguro de eliminar este trabajo?\n\n" +
    "Esta acción es permanente y puede eliminar " +
    "también los datos relacionados, según la " +
    "configuración de Supabase."
  );

  if (!confirmar) return;

  const { data: usuario, error: errorUsuario } =
    await supabase.auth.getUser();

  if (errorUsuario || !usuario.user) {
    alert("Debes iniciar sesión.");
    return;
  }

  const { data, error } = await supabase
    .from("reparaciones")
    .delete()
    .eq("id", id)
    .eq("mecanico_id", usuario.user.id)
    .select("id");

  if (error) {
    alert(
      "No se pudo eliminar el trabajo.\n" +
      error.message +
      "\n\nComprueba los permisos y las relaciones " +
      "de las tablas en Supabase."
    );
    return;
  }

  if (!data || data.length === 0) {
    alert(
      "El trabajo no se eliminó. " +
      "Puede que no tengas permiso."
    );
    return;
  }

  tarjeta.remove();

  alert("Trabajo eliminado correctamente.");

  // Actualizar estadísticas y lista.
  document.getElementById("actualizar")?.click();
}

function agregarOpciones(tarjeta) {
  if (tarjeta.dataset.opcionesAgregadas === "si") {
    return;
  }

  const id = tarjeta.dataset.reparacionId;

  if (!id) return;

  tarjeta.dataset.opcionesAgregadas = "si";

  const contenedor = document.createElement("div");
  contenedor.className = "opciones-trabajo";

  const ver = crearBoton(
    "👁️ Ver detalles",
    () => {
      window.open(
        `trabajo-detalle.html?id=${encodeURIComponent(id)}`,
        "_blank",
        "noopener"
      );
    }
  );

  const pdf = crearBoton(
    "📄 Guardar PDF",
    () => {
      window.open(
        `trabajo-detalle.html?id=${encodeURIComponent(id)}&imprimir=1`,
        "_blank",
        "noopener"
      );
    }
  );

  const eliminar = crearBoton(
    "🗑️ Eliminar",
    () => eliminarTrabajo(id, tarjeta),
    "boton-eliminar"
  );

  contenedor.append(ver, pdf, eliminar);
  tarjeta.appendChild(contenedor);
}

function actualizarBotones() {
  if (!lista) return;

  lista.querySelectorAll(
    ".reparacion[data-reparacion-id]"
  ).forEach(agregarOpciones);
}

if (lista) {
  const observador = new MutationObserver(
    actualizarBotones
  );

  observador.observe(lista, {
    childList: true,
    subtree: true
  });

  actualizarBotones();
}
