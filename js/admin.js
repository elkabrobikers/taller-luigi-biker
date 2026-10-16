
import { supabase } from "./supabase.js";

const $ = id => document.getElementById(id);

const dashboard = $("dashboard");
const cargando = $("cargando");
const nombreAdmin = $("nombre-admin");
const botonSalir = $("cerrar-sesion");
const botonActualizar = $("actualizar-estadisticas");

const mensajeEstadisticas = $("mensaje-estadisticas");

// ==========================================
// ACTUALIZAR UNA TARJETA
// ==========================================

function mostrarTarjeta(idTotal, idDetalle, total, detalle) {
  $(idTotal).textContent = total;
  $(idDetalle).textContent = detalle;
}

// ==========================================
// CONSULTAR TOTAL DE REGISTROS
// ==========================================

async function contarRegistros(tabla, filtros = []) {
  let consulta = supabase
    .from(tabla)
    .select("*", {
      count: "exact",
      head: true
    });

  for (const filtro of filtros) {
    consulta = consulta.eq(
      filtro.columna,
      filtro.valor
    );
  }

  const { count, error } = await consulta;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ==========================================
// CONSULTAR REPARACIONES PENDIENTES
// ==========================================

async function contarReparacionesPendientes() {
  const { count, error } = await supabase
    .from("reparaciones")
    .select("*", {
      count: "exact",
      head: true
    })
    .neq("estado", "finalizada");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ==========================================
// CARGAR ESTADÍSTICAS
// ==========================================

async function cargarEstadisticas() {
  botonActualizar.disabled = true;
  botonActualizar.textContent = "↻ Actualizando...";

  mensajeEstadisticas.textContent =
    "Consultando información del taller...";

  const consultas = [
    {
      nombre: "Motocicletas",
      total: "total-motos",
      detalle: "detalle-motos",
      ejecutar: () => contarRegistros("motocicletas"),
      descripcion: "Total de motocicletas registradas"
    },
    {
      nombre: "Reparaciones",
      total: "total-reparaciones",
      detalle: "detalle-reparaciones",
      ejecutar: contarReparacionesPendientes,
      descripcion: "Trabajos que aún no están finalizados"
    },
    {
      nombre: "Mecánicos",
      total: "total-mecanicos",
      detalle: "detalle-mecanicos",
      ejecutar: () => contarRegistros(
        "perfiles",
        [
          { columna: "rol", valor: "mecanico" },
          { columna: "activo", valor: true }
        ]
      ),
      descripcion: "Cuentas de mecánicos activas"
    },
    {
      nombre: "Ventas",
      total: "total-ventas",
      detalle: "detalle-ventas",
      ejecutar: () => contarRegistros("ventas"),
      descripcion: "Total de ventas registradas"
    }
  ];

  const resultados = await Promise.allSettled(
    consultas.map(item => item.ejecutar())
  );

  let errores = 0;

  resultados.forEach((resultado, indice) => {
    const item = consultas[indice];

    if (resultado.status === "fulfilled") {
      mostrarTarjeta(
        item.total,
        item.detalle,
        resultado.value.toLocaleString("es-BO"),
        item.descripcion
      );
    } else {
      errores++;

      mostrarTarjeta(
        item.total,
        item.detalle,
        "—",
        "No se pudo consultar este dato"
      );

      console.error(
        "Error al consultar " + item.nombre + ":",
        resultado.reason
      );
    }
  });

  if (errores === 0) {
    mensajeEstadisticas.textContent =
      "Datos del taller actualizados correctamente.";
  } else {
    mensajeEstadisticas.textContent =
      "Se actualizaron " +
      (consultas.length - errores) +
      " de " +
      consultas.length +
      " estadísticas. Revisa los permisos o las tablas pendientes.";
  }

  botonActualizar.disabled = false;
  botonActualizar.textContent = "↻ Actualizar datos";
}

// ==========================================
// VERIFICAR ADMINISTRADOR
// ==========================================

async function verificarAdministrador() {
  try {
    const {
      data,
      error
    } = await supabase.auth.getUser();

    if (error || !data.user) {
      window.location.replace("login.html");
      return;
    }

    const {
      data: perfil,
      error: errorPerfil
    } = await supabase
      .from("perfiles")
      .select("nombre,rol,activo")
      .eq("id", data.user.id)
      .single();

    if (errorPerfil) {
      throw errorPerfil;
    }

    if (
      !perfil ||
      perfil.rol !== "admin" ||
      !perfil.activo
    ) {
      cargando.textContent =
        "Acceso denegado: esta cuenta no es administradora.";
      return;
    }

    nombreAdmin.textContent =
      perfil.nombre || "Administrador";

    cargando.hidden = true;
    dashboard.hidden = false;

    await cargarEstadisticas();

    console.log(
      "Panel administrador cargado correctamente"
    );

  } catch (error) {
    console.error(
      "Error al verificar administrador:",
      error
    );

    if (dashboard.hidden) {
      cargando.textContent =
        "Error al verificar el acceso: " +
        error.message;
    }
  }
}

// ==========================================
// BOTÓN ACTUALIZAR
// ==========================================

botonActualizar.addEventListener(
  "click",
  cargarEstadisticas
);

// ==========================================
// CERRAR SESIÓN
// ==========================================

botonSalir.addEventListener("click", async () => {
  botonSalir.disabled = true;

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(
      "Error al cerrar sesión: " +
      error.message
    );

    botonSalir.disabled = false;
    return;
  }

  window.location.replace("login.html");
});

// ==========================================
// INICIAR
// ==========================================

verificarAdministrador();
