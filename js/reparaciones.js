
import { supabase } from "./supabase.js";

// =====================================================
// TALLER LUIGI BIKER - GESTIÓN DE REPARACIONES
// REGISTRAR, CONSULTAR, EDITAR Y ELIMINAR
// =====================================================

// ELEMENTOS DEL HTML
const verificando = document.getElementById("verificando");
const contenido = document.getElementById("contenido");
const formulario = document.getElementById("form-reparacion");
const selectorMoto = document.getElementById("moto");
const selectorMecanico = document.getElementById("mecanico");
const estado = document.getElementById("estado");
const costo = document.getElementById("costo");
const descripcion = document.getElementById("descripcion");
const diagnostico = document.getElementById("diagnostico");
const guardar = document.getElementById("guardar");
const mensajeForm = document.getElementById("mensaje-form");
const mensajeLista = document.getElementById("mensaje-lista");
const lista = document.getElementById("lista");
const buscar = document.getElementById("buscar");
const actualizar = document.getElementById("actualizar");

// VARIABLES
let motos = [];
let mecanicos = [];
let reparaciones = [];
let autorizado = false;
let reparacionEditando = null;
let procesando = false;

// ESTADOS
const estados = {
  recibida: "Recibida",
  en_reparacion: "En reparación",
  finalizada: "Finalizada"
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function mensaje(elemento, texto, color = "#cccccc") {
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.style.color = color;
}

function agregarTexto(contenedor, etiqueta, valor) {
  const p = document.createElement("p");
  const strong = document.createElement("strong");

  strong.textContent = etiqueta + ": ";

  p.appendChild(strong);
  p.appendChild(
    document.createTextNode(
      String(valor ?? "No registrado")
    )
  );

  contenedor.appendChild(p);
}

function agregarOpcion(select, valor, texto) {
  const opcion = document.createElement("option");

  opcion.value = String(valor);
  opcion.textContent = texto;

  select.appendChild(opcion);
}

function nombreMecanico(id) {
  if (!id) return "Sin asignar";

  const mecanico = mecanicos.find(
    m => String(m.id) === String(id)
  );

  return mecanico
    ? mecanico.nombre || "Mecánico"
    : "Mecánico no disponible";
}

function nombreMoto(id) {
  const moto = motos.find(
    m => String(m.id) === String(id)
  );

  if (!moto) return "Moto #" + id;

  return (
    (moto.placa || "Sin placa") +
    " - " +
    (moto.marca || "Sin marca") +
    " - " +
    (moto.nombre_propietario || "Sin propietario")
  );
}

function fechaLegible(valor) {
  if (!valor) return "No registrada";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Fecha no válida";
  }

  return fecha.toLocaleString("es-BO");
}

function costoLegible(valor) {
  const numero = Number(valor || 0);

  return "Bs. " + numero.toFixed(2);
}

function crearBoton(texto, clase = "") {
  const boton = document.createElement("button");

  boton.type = "button";
  boton.textContent = texto;

  if (clase) {
    boton.className = clase;
  }

  return boton;
}

// =====================================================
// BOTÓN CANCELAR EDICIÓN
// SE CREA AUTOMÁTICAMENTE
// =====================================================

const cancelarEdicion = crearBoton(
  "Cancelar edición",
  "btn-cancelar-edicion"
);

cancelarEdicion.hidden = true;
cancelarEdicion.style.marginLeft = "10px";

guardar.insertAdjacentElement(
  "afterend",
  cancelarEdicion
);

// =====================================================
// CONTROL DEL FORMULARIO
// =====================================================

function actualizarBotonGuardar() {
  guardar.disabled =
    !autorizado ||
    procesando ||
    motos.length === 0;

  if (procesando) {
    guardar.textContent = "Guardando...";
  } else if (reparacionEditando !== null) {
    guardar.textContent = "Guardar cambios";
  } else {
    guardar.textContent = "Guardar orden de reparación";
  }
}

function limpiarFormulario() {
  formulario.reset();

  costo.value = "0";
  reparacionEditando = null;

  cancelarEdicion.hidden = true;

  actualizarBotonGuardar();
}

cancelarEdicion.addEventListener("click", () => {
  if (procesando) return;

  limpiarFormulario();

  mensaje(
    mensajeForm,
    "Edición cancelada.",
    "#cccccc"
  );
});

// =====================================================
// VERIFICAR ADMINISTRADOR
// =====================================================

async function verificarAcceso() {
  try {
    const { data, error } =
      await supabase.auth.getUser();

    if (error || !data.user) {
      window.location.replace("login.html");
      return;
    }

    const { data: perfil, error: errorPerfil } =
      await supabase
        .from("perfiles")
        .select("rol, activo")
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
      verificando.textContent =
        "Acceso denegado. Solo administradores activos.";

      return;
    }

    autorizado = true;

    verificando.hidden = true;
    contenido.hidden = false;

    await cargarDatos();

  } catch (error) {
    console.error(error);

    verificando.textContent =
      "Error al verificar acceso: " +
      error.message;
  }
}

// =====================================================
// CARGAR MOTOCICLETAS, MECÁNICOS Y REPARACIONES
// =====================================================

async function cargarDatos() {
  if (!autorizado || procesando) return;

  actualizar.disabled = true;
  guardar.disabled = true;

  try {
    mensaje(
      mensajeLista,
      "Cargando información..."
    );

    const [resultadoMotos, resultadoMecanicos] =
      await Promise.all([
        supabase
          .from("motocicletas")
          .select(
            "id, placa, marca, nombre_propietario"
          )
          .order("placa")
          .limit(1000),

        supabase
          .from("perfiles")
          .select("id, nombre, rol, activo")
          .eq("rol", "mecanico")
          .limit(500)
      ]);

    if (resultadoMotos.error) {
      throw resultadoMotos.error;
    }

    if (resultadoMecanicos.error) {
      throw resultadoMecanicos.error;
    }

    motos = resultadoMotos.data || [];
    mecanicos = resultadoMecanicos.data || [];

    // CONSERVAR SELECCIONES ACTUALES
    const motoSeleccionada = selectorMoto.value;
    const mecanicoSeleccionado = selectorMecanico.value;

    // CARGAR MOTOCICLETAS
    selectorMoto.replaceChildren();

    agregarOpcion(
      selectorMoto,
      "",
      "Seleccionar motocicleta"
    );

    for (const moto of motos) {
      agregarOpcion(
        selectorMoto,
        moto.id,
        nombreMoto(moto.id)
      );
    }

    // CARGAR MECÁNICOS ACTIVOS
    selectorMecanico.replaceChildren();

    agregarOpcion(
      selectorMecanico,
      "",
      "Sin asignar"
    );

    for (const mecanico of mecanicos) {
      if (!mecanico.activo) continue;

      agregarOpcion(
        selectorMecanico,
        mecanico.id,
        mecanico.nombre || "Mecánico"
      );
    }

    // CONSERVAR MECÁNICO INACTIVO SI ESTÁ
    // ASIGNADO A LA ORDEN QUE SE ESTÁ EDITANDO
    if (
      mecanicoSeleccionado &&
      !Array.from(selectorMecanico.options).some(
        opcion =>
          opcion.value === mecanicoSeleccionado
      )
    ) {
      const mecanicoAnterior = mecanicos.find(
        m =>
          String(m.id) ===
          String(mecanicoSeleccionado)
      );

      if (mecanicoAnterior) {
        agregarOpcion(
          selectorMecanico,
          mecanicoAnterior.id,
          (mecanicoAnterior.nombre || "Mecánico") +
          " (inactivo)"
        );
      }
    }

    selectorMoto.value = motoSeleccionada;
    selectorMecanico.value = mecanicoSeleccionado;

    await cargarReparaciones();

    if (motos.length === 0) {
      mensaje(
        mensajeForm,
        "Primero registra una motocicleta.",
        "#ffbd87"
      );
    }

  } catch (error) {
    console.error(error);

    mensaje(
      mensajeForm,
      "Error al cargar datos: " + error.message,
      "#ff5252"
    );

  } finally {
    actualizar.disabled = false;
    actualizarBotonGuardar();
  }
}

// =====================================================
// CARGAR REPARACIONES
// =====================================================

async function cargarReparaciones() {
  const { data, error } = await supabase
    .from("reparaciones")
    .select(
      "id, moto_id, mecanico_id, descripcion, " +
      "diagnostico, estado, costo_mano_obra, " +
      "fecha_ingreso, fecha_entrega"
    )
    .order("fecha_ingreso", {
      ascending: false
    })
    .limit(100);

  if (error) {
    throw error;
  }

  reparaciones = data || [];

  mostrarReparaciones();
}

// =====================================================
// EDITAR REPARACIÓN
// =====================================================

function editarReparacion(reparacion) {
  if (!autorizado || procesando) return;

  reparacionEditando = reparacion.id;

  selectorMoto.value = String(reparacion.moto_id);

  // Si el mecánico está inactivo, agregarlo
  // temporalmente al selector para conservarlo.
  if (reparacion.mecanico_id) {
    const idMecanico = String(
      reparacion.mecanico_id
    );

    const existe = Array.from(
      selectorMecanico.options
    ).some(
      opcion => opcion.value === idMecanico
    );

    if (!existe) {
      agregarOpcion(
        selectorMecanico,
        idMecanico,
        nombreMecanico(idMecanico) +
        " (asignado anteriormente)"
      );
    }
  }

  selectorMecanico.value =
    reparacion.mecanico_id
      ? String(reparacion.mecanico_id)
      : "";

  descripcion.value =
    reparacion.descripcion || "";

  diagnostico.value =
    reparacion.diagnostico || "";

  costo.value =
    reparacion.costo_mano_obra ?? 0;

  // Conservar estados no previstos en el HTML
  if (
    reparacion.estado &&
    !Array.from(estado.options).some(
      opcion =>
        opcion.value === reparacion.estado
    )
  ) {
    agregarOpcion(
      estado,
      reparacion.estado,
      reparacion.estado
    );
  }

  estado.value = reparacion.estado;

  cancelarEdicion.hidden = false;

  actualizarBotonGuardar();

  mensaje(
    mensajeForm,
    "Editando orden #" + reparacion.id,
    "#ffbd87"
  );

  formulario.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  descripcion.focus();
}

// =====================================================
// ACTUALIZAR ESTADO RÁPIDAMENTE
// =====================================================

async function actualizarEstadoReparacion(
  reparacion,
  nuevoEstado,
  boton
) {
  if (!autorizado || procesando) return;

  boton.disabled = true;

  try {
    const cambios = {
      estado: nuevoEstado,
      fecha_entrega:
        nuevoEstado === "finalizada"
          ? (
              reparacion.fecha_entrega ||
              new Date().toISOString()
            )
          : null
    };

    const { error } = await supabase
      .from("reparaciones")
      .update(cambios)
      .eq("id", reparacion.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    await cargarReparaciones();

    mensaje(
      mensajeLista,
      "Estado actualizado correctamente.",
      "#00e676"
    );

  } catch (error) {
    console.error(error);

    mensaje(
      mensajeLista,
      "Error al actualizar: " + error.message,
      "#ff5252"
    );

  } finally {
    boton.disabled = false;
  }
}

// =====================================================
// ELIMINAR REPARACIÓN
// =====================================================

async function eliminarReparacion(reparacion) {
  if (!autorizado || procesando) return;

  const confirmado = window.confirm(
    "¿Estás seguro de eliminar la orden #" +
    reparacion.id +
    "?\n\n" +
    "También se eliminarán sus avances, " +
    "historial, repuestos asociados, " +
    "notificaciones y facturas relacionadas." +
    "\n\n" +
    "La motocicleta, el cliente, el mecánico " +
    "y los productos del inventario " +
    "se conservarán." +
    "\n\n" +
    "Esta acción no se puede deshacer."
  );

  if (!confirmado) return;

  procesando = true;
  actualizarBotonGuardar();
  actualizar.disabled = true;

  try {
    mensaje(
      mensajeLista,
      "Eliminando orden #" + reparacion.id + "..."
    );

    const { error } = await supabase.rpc(
      "eliminar_reparacion_admin",
      {
        p_reparacion_id: reparacion.id
      }
    );

    if (error) {
      throw error;
    }

    // Si se eliminó la orden que estaba en edición
    if (
      String(reparacionEditando) ===
      String(reparacion.id)
    ) {
      limpiarFormulario();
    }

    await cargarReparaciones();

    mensaje(
      mensajeLista,
      "Orden #" + reparacion.id +
      " eliminada correctamente.",
      "#00e676"
    );

  } catch (error) {
    console.error(error);

    mensaje(
      mensajeLista,
      "No se pudo eliminar: " + error.message,
      "#ff5252"
    );

  } finally {
    procesando = false;
    actualizar.disabled = false;
    actualizarBotonGuardar();
  }
}

// =====================================================
// MOSTRAR REPARACIONES
// =====================================================

function mostrarReparaciones() {
  const filtro = buscar.value
    .trim()
    .toLowerCase();

  const filtradas = reparaciones.filter(
    reparacion => {
      const datos = [
        reparacion.id,
        nombreMoto(reparacion.moto_id),
        nombreMecanico(reparacion.mecanico_id),
        reparacion.descripcion,
        reparacion.diagnostico,
        reparacion.estado,
        estados[reparacion.estado] || ""
      ]
        .join(" ")
        .toLowerCase();

      return datos.includes(filtro);
    }
  );

  lista.replaceChildren();

  if (!filtradas.length) {
    mensaje(
      mensajeLista,
      filtro
        ? "No se encontraron reparaciones."
        : "Todavía no hay reparaciones registradas."
    );

    return;
  }

  mensaje(
    mensajeLista,
    "Mostrando " + filtradas.length +
    " reparación(es), de las 100 más recientes."
  );

  for (const reparacion of filtradas) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "orden";

    // TÍTULO
    const titulo = document.createElement("h3");
    titulo.textContent =
      "Orden #" + reparacion.id;

    tarjeta.appendChild(titulo);

    // INFORMACIÓN
    agregarTexto(
      tarjeta,
      "Motocicleta",
      nombreMoto(reparacion.moto_id)
    );

    agregarTexto(
      tarjeta,
      "Mecánico",
      nombreMecanico(reparacion.mecanico_id)
    );

    agregarTexto(
      tarjeta,
      "Trabajo",
      reparacion.descripcion
    );

    agregarTexto(
      tarjeta,
      "Diagnóstico",
      reparacion.diagnostico || "Pendiente"
    );

    agregarTexto(
      tarjeta,
      "Mano de obra",
      costoLegible(reparacion.costo_mano_obra)
    );

    // ESTADO ACTUAL
    const etiquetaEstado =
      document.createElement("span");

    etiquetaEstado.className =
      "estado " + reparacion.estado;

    etiquetaEstado.textContent =
      estados[reparacion.estado] ||
      reparacion.estado;

    tarjeta.appendChild(etiquetaEstado);

    // FECHAS
    if (reparacion.fecha_ingreso) {
      agregarTexto(
        tarjeta,
        "Ingreso",
        fechaLegible(reparacion.fecha_ingreso)
      );
    }

    if (reparacion.fecha_entrega) {
      agregarTexto(
        tarjeta,
        "Finalización",
        fechaLegible(reparacion.fecha_entrega)
      );
    }

    // CONTENEDOR DE ACCIONES
    const acciones = document.createElement("div");
    acciones.className = "acciones";

    // SELECTOR DE ESTADO
    const selectorEstado =
      document.createElement("select");

    selectorEstado.setAttribute(
      "aria-label",
      "Estado de orden " + reparacion.id
    );

    for (const [valor, texto] of Object.entries(
      estados
    )) {
      agregarOpcion(
        selectorEstado,
        valor,
        texto
      );
    }

    // CONSERVAR ESTADOS DESCONOCIDOS
    if (!estados[reparacion.estado]) {
      agregarOpcion(
        selectorEstado,
        reparacion.estado,
        reparacion.estado
      );
    }

    selectorEstado.value =
      reparacion.estado;

    // BOTÓN ACTUALIZAR ESTADO
    const botonActualizar = crearBoton(
      "Actualizar estado",
      "btn-actualizar-estado"
    );

    botonActualizar.addEventListener(
      "click",
      async () => {
        await actualizarEstadoReparacion(
          reparacion,
          selectorEstado.value,
          botonActualizar
        );
      }
    );

    // BOTÓN EDITAR
    const botonEditar = crearBoton(
      "✏️ Editar",
      "btn-editar"
    );

    botonEditar.addEventListener(
      "click",
      () => editarReparacion(reparacion)
    );

    // BOTÓN ELIMINAR
    const botonEliminar = crearBoton(
      "🗑️ Eliminar",
      "btn-eliminar"
    );

    botonEliminar.addEventListener(
      "click",
      async () => {
        await eliminarReparacion(reparacion);
      }
    );

    // AGREGAR ACCIONES
    acciones.appendChild(selectorEstado);
    acciones.appendChild(botonActualizar);
    acciones.appendChild(botonEditar);
    acciones.appendChild(botonEliminar);

    tarjeta.appendChild(acciones);
    lista.appendChild(tarjeta);
  }
}

// =====================================================
// REGISTRAR O EDITAR ORDEN DE REPARACIÓN
// =====================================================

formulario.addEventListener(
  "submit",
  async evento => {
    evento.preventDefault();

    if (!autorizado || procesando) return;

    const motoId = Number(selectorMoto.value);
    const costoValor = Number(costo.value);
    const textoDescripcion =
      descripcion.value.trim();

    // VALIDAR MOTOCICLETA
    if (!motoId || !textoDescripcion) {
      mensaje(
        mensajeForm,
        "Selecciona una moto y describe el trabajo.",
        "#ff5252"
      );

      return;
    }

    // VALIDAR COSTO
    if (
      costo.value.trim() === "" ||
      !Number.isFinite(costoValor) ||
      costoValor < 0
    ) {
      mensaje(
        mensajeForm,
        "El costo debe ser un número válido.",
        "#ff5252"
      );

      return;
    }

    // VALIDAR ESTADO
    if (!estado.value) {
      mensaje(
        mensajeForm,
        "Selecciona el estado de la reparación.",
        "#ff5252"
      );

      return;
    }

    const editando = reparacionEditando !== null;

    const reparacionOriginal = editando
      ? reparaciones.find(
          r =>
            String(r.id) ===
            String(reparacionEditando)
        )
      : null;

    if (editando && !reparacionOriginal) {
      mensaje(
        mensajeForm,
        "La reparación ya no está disponible. Actualiza la página.",
        "#ff5252"
      );

      return;
    }

    procesando = true;
    actualizarBotonGuardar();
    cancelarEdicion.disabled = true;

    try {
      const datosOrden = {
        moto_id: motoId,
        mecanico_id:
          selectorMecanico.value || null,
        descripcion: textoDescripcion,
        diagnostico:
          diagnostico.value.trim() || null,
        estado: estado.value,
        costo_mano_obra: costoValor,
        fecha_entrega:
          estado.value === "finalizada"
            ? (
                reparacionOriginal?.fecha_entrega ||
                new Date().toISOString()
              )
            : null
      };

      if (editando) {
        // =====================================
        // ACTUALIZAR REPARACIÓN EXISTENTE
        // =====================================

        const { error } = await supabase
          .from("reparaciones")
          .update(datosOrden)
          .eq("id", reparacionEditando)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

      } else {
        // =====================================
        // REGISTRAR NUEVA REPARACIÓN
        // =====================================

        const { error } = await supabase
          .from("reparaciones")
          .insert(datosOrden);

        if (error) {
          throw error;
        }
      }

      limpiarFormulario();

      await cargarReparaciones();

      mensaje(
        mensajeForm,
        editando
          ? "¡Orden de reparación actualizada correctamente!"
          : "¡Orden de reparación registrada correctamente!",
        "#00e676"
      );

    } catch (error) {
      console.error(error);

      mensaje(
        mensajeForm,
        "Error al guardar: " + error.message,
        "#ff5252"
      );

    } finally {
      procesando = false;
      cancelarEdicion.disabled = false;
      actualizarBotonGuardar();
    }
  }
);

// =====================================================
// BUSCADOR
// =====================================================

buscar.addEventListener(
  "input",
  mostrarReparaciones
);

// =====================================================
// ACTUALIZAR INFORMACIÓN
// =====================================================

actualizar.addEventListener(
  "click",
  cargarDatos
);

// =====================================================
// INICIAR MÓDULO
// =====================================================

verificarAcceso();
