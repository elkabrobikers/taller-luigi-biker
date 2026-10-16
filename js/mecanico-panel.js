
import { supabase } from "./supabase.js";

// ========================================
// TALLER LUIGI BIKER - PANEL MECÁNICO
// ========================================

const $ = id => document.getElementById(id);
const dinero = n => "Bs. " + Number(n || 0).toFixed(2);

let usuarioActual = null;
let repuestosTemporales = [];
let fotoTemporalURL = null;
let canalTiempoReal = null;
let actualizacionPendiente = false;

function mensaje(id, texto, error = false) {
  const elemento = $(id);
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.style.color = error ? "#ff6868" : "#22c55e";
}

function nodo(tag, texto = "", clase = "") {
  const elemento = document.createElement(tag);
  elemento.textContent = String(texto ?? "");
  if (clase) elemento.className = clase;
  return elemento;
}

function fecha(valor) {
  return valor
    ? new Date(valor).toLocaleString("es-BO")
    : "Sin registrar";
}

function dato(contenedor, nombre, valor) {
  contenedor.appendChild(
    nodo("p", `${nombre}: ${valor ?? "Sin registrar"}`)
  );
}

function boton(texto, accion, clase = "") {
  const b = nodo("button", texto, clase);
  b.type = "button";
  b.addEventListener("click", accion);
  return b;
}

// ========================================
// ACCESO
// ========================================

async function iniciarPanel() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      location.replace("login.html");
      return;
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select("nombre, rol, activo")
      .eq("id", data.user.id)
      .single();

    if (errorPerfil) throw errorPerfil;

    if (!perfil || perfil.rol !== "mecanico" || !perfil.activo) {
      $("verificando").textContent =
        "No tienes autorización para ingresar como mecánico.";
      return;
    }

    usuarioActual = data.user.id;
    $("nombre-mecanico").textContent = perfil.nombre || "Mecánico";
    $("verificando").hidden = true;
    $("panel").hidden = false;

    await Promise.all([
      cargarMotos(),
      cargarReparaciones()
    ]);

    activarTiempoReal();
  } catch (error) {
    console.error(error);
    $("verificando").textContent =
      "Error al cargar el panel: " + error.message;
  }
}

// ========================================
// MOTOCICLETAS
// ========================================

async function cargarMotos(seleccion = "") {
  const selector = $("reparacion-moto");
  const anterior = seleccion || selector.value;

  const { data, error } = await supabase
    .from("motocicletas")
    .select("id, placa, marca, modelo")
    .order("id", { ascending: false })
    .limit(300);

  if (error) {
    mensaje(
      "mensaje-reparacion",
      "Error al cargar motos: " + error.message,
      true
    );
    return;
  }

  selector.replaceChildren();
  const inicial = nodo("option", "Selecciona una motocicleta");
  inicial.value = "";
  selector.appendChild(inicial);

  for (const moto of data || []) {
    const opcion = nodo(
      "option",
      `${moto.placa} — ${moto.marca} ${moto.modelo || ""}`
    );
    opcion.value = moto.id;
    selector.appendChild(opcion);
  }

  selector.value = anterior;
  if (!selector.value) selector.value = "";
}

$("moto-foto").addEventListener("change", () => {
  const archivo = $("moto-foto").files[0];
  const imagen = $("moto-vista-foto");

  if (fotoTemporalURL) URL.revokeObjectURL(fotoTemporalURL);
  fotoTemporalURL = null;
  imagen.hidden = true;
  imagen.removeAttribute("src");

  if (!archivo) return;

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(archivo.type) ||
    archivo.size > 5 * 1024 * 1024
  ) {
    mensaje("mensaje-moto", "Foto inválida. JPG, PNG o WebP, máximo 5 MB.", true);
    $("moto-foto").value = "";
    return;
  }

  fotoTemporalURL = URL.createObjectURL(archivo);
  imagen.src = fotoTemporalURL;
  imagen.hidden = false;
});

$("form-moto-mecanico").addEventListener("submit", async e => {
  e.preventDefault();
  if (!usuarioActual) return;

  const guardar = $("guardar-moto");
  guardar.disabled = true;
  guardar.textContent = "Guardando moto...";

  let rutaFoto = null;
  let motoGuardada = false;

  try {
    const placa = $("moto-placa").value.trim().toUpperCase();
    const marca = $("moto-marca").value.trim();
    const modelo = $("moto-modelo").value.trim();
    const color = $("moto-color").value.trim();
    const propietario = $("moto-propietario").value.trim();
    const celular = $("moto-celular").value.trim();
    const observaciones = $("moto-observaciones").value.trim();

    if (!placa || !marca || !propietario || !celular) {
      throw new Error("Completa los campos obligatorios.");
    }

    const archivo = $("moto-foto").files[0];

    if (archivo) {
      const extensiones = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      };

      const extension = extensiones[archivo.type];

      if (!extension || archivo.size > 5 * 1024 * 1024) {
        throw new Error("Fotografía inválida.");
      }

      rutaFoto = `motocicletas/${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from("fotos-motos")
        .upload(rutaFoto, archivo, {
          contentType: archivo.type,
          upsert: false
        });

      if (error) throw error;
    }

    const { data, error } = await supabase
      .from("motocicletas")
      .insert({
        placa,
        marca,
        modelo: modelo || null,
        color: color || null,
        nombre_propietario: propietario,
        celular_propietario: celular,
        observaciones: observaciones || null,
        foto_url: rutaFoto,
        propietario_id: null,
        registrado_por: usuarioActual
      })
      .select("id")
      .single();

    if (error) throw error;
    motoGuardada = true;

    $("form-moto-mecanico").reset();

    if (fotoTemporalURL) URL.revokeObjectURL(fotoTemporalURL);
    fotoTemporalURL = null;
    $("moto-vista-foto").hidden = true;
    $("moto-vista-foto").removeAttribute("src");

    await cargarMotos(String(data.id));
    mensaje("mensaje-moto", "¡Motocicleta registrada correctamente!");
  } catch (error) {
    console.error(error);

    if (rutaFoto && !motoGuardada) {
      await supabase.storage.from("fotos-motos").remove([rutaFoto]);
    }

    mensaje("mensaje-moto", "Error: " + error.message, true);
  } finally {
    guardar.disabled = false;
    guardar.textContent = "💾 Guardar motocicleta";
  }
});

// ========================================
// REPUESTOS Y MANO DE OBRA
// ========================================

function calcularTotales() {
  const repuestos = repuestosTemporales.reduce(
    (total, r) => total + r.cantidad * r.precio_unitario,
    0
  );

  const incluir = $("incluir-mano-obra").checked;
  const precio = Number($("reparacion-costo").value);
  const mano = incluir && Number.isFinite(precio) && precio >= 0
    ? precio
    : 0;

  $("total-repuestos").textContent = dinero(repuestos);
  $("total-mano-obra").textContent = dinero(mano);
  $("total-estimado").textContent = dinero(repuestos + mano);

  $("contenedor-mano-obra").hidden = !incluir;
  $("fila-mano-obra").hidden = !incluir;
  $("reparacion-costo").required = incluir;
}

function mostrarRepuestos() {
  const lista = $("lista-repuestos");
  lista.replaceChildren();

  repuestosTemporales.forEach((r, indice) => {
    const fila = nodo("div", "", "item-repuesto");
    const info = document.createElement("div");

    info.appendChild(nodo("strong", r.nombre));
    info.appendChild(
      nodo(
        "p",
        `${r.cantidad} × ${dinero(r.precio_unitario)} = ` +
        dinero(r.cantidad * r.precio_unitario)
      )
    );

    fila.append(
      info,
      boton("Eliminar", () => {
        repuestosTemporales.splice(indice, 1);
        mostrarRepuestos();
      })
    );

    lista.appendChild(fila);
  });

  calcularTotales();
}

$("agregar-repuesto").addEventListener("click", () => {
  const nombre = $("repuesto-nombre").value.trim();
  const cantidadTexto = $("repuesto-cantidad").value;
  const precioTexto = $("repuesto-precio").value;
  const cantidad = Number(cantidadTexto);
  const precio = Number(precioTexto);

  if (!nombre) {
    alert("Escribe el nombre del repuesto.");
    return;
  }

  if (!Number.isInteger(cantidad) || cantidad < 1) {
    alert("La cantidad debe ser un entero mayor a cero.");
    return;
  }

  if (
    precioTexto.trim() === "" ||
    !Number.isFinite(precio) ||
    precio < 0
  ) {
    alert("Escribe un precio válido.");
    return;
  }

  repuestosTemporales.push({
    nombre,
    cantidad,
    precio_unitario: Number(precio.toFixed(2))
  });

  $("repuesto-nombre").value = "";
  $("repuesto-cantidad").value = "1";
  $("repuesto-precio").value = "";
  mostrarRepuestos();
  $("repuesto-nombre").focus();
});

$("incluir-mano-obra").addEventListener("change", calcularTotales);
$("reparacion-costo").addEventListener("input", calcularTotales);

// ========================================
// GUARDAR TRABAJO
// ========================================

$("form-reparacion-mecanico").addEventListener("submit", async e => {
  e.preventDefault();
  if (!usuarioActual) return;

  const motoId = Number($("reparacion-moto").value);
  const tipo = $("reparacion-tipo").value;
  const descripcion = $("reparacion-descripcion").value.trim();
  const incluirMano = $("incluir-mano-obra").checked;
  const precioTexto = $("reparacion-costo").value;
  const costoMano = incluirMano ? Number(precioTexto) : 0;

  if (!motoId || !tipo || !descripcion) {
    mensaje("mensaje-reparacion", "Completa moto, tipo y descripción.", true);
    return;
  }

  if (
    incluirMano &&
    (
      precioTexto.trim() === "" ||
      !Number.isFinite(costoMano) ||
      costoMano < 0
    )
  ) {
    mensaje("mensaje-reparacion", "Precio de mano de obra inválido.", true);
    return;
  }

  const guardar = $("guardar-reparacion");
  guardar.disabled = true;
  guardar.textContent = "Guardando trabajo...";

  try {
    const { data, error } = await supabase.rpc(
      "crear_trabajo_mecanico",
      {
        p_moto_id: motoId,
        p_tipo: tipo,
        p_descripcion: descripcion,
        p_incluir_mano_obra: incluirMano,
        p_costo_mano_obra: costoMano,
        p_repuestos: repuestosTemporales
      }
    );

    if (error) throw error;

    $("form-reparacion-mecanico").reset();
    repuestosTemporales = [];
    mostrarRepuestos();

    mensaje(
      "mensaje-reparacion",
      `¡Trabajo #${data} registrado correctamente!`
    );

    await cargarReparaciones();
  } catch (error) {
    console.error(error);
    mensaje(
      "mensaje-reparacion",
      "No se pudo guardar: " + error.message,
      true
    );
  } finally {
    guardar.disabled = false;
    guardar.textContent = "➕ Agregar trabajo a la moto";
  }
});

// ========================================
// ELIMINAR TRABAJO
// ========================================

async function eliminarTrabajo(id, botonEliminar) {
  const confirmar = confirm(
    `¿Eliminar definitivamente el trabajo #${id}?\n\n` +
    "Esta acción no se puede deshacer."
  );

  if (!confirmar) return;

  botonEliminar.disabled = true;

  try {
    const { data, error } = await supabase
      .from("reparaciones")
      .delete()
      .eq("id", id)
      .eq("mecanico_id", usuarioActual)
      .select("id");

    if (error) throw error;

    if (!data || !data.length) {
      throw new Error(
        "No se eliminó el trabajo. Comprueba tus permisos."
      );
    }

    alert("Trabajo eliminado correctamente.");
    await cargarReparaciones();
  } catch (error) {
    console.error(error);
    alert(
      "No se pudo eliminar:\n" + error.message +
      "\n\nEs posible que existan repuestos o avances relacionados, " +
      "o que Supabase no permita eliminar este registro."
    );
    botonEliminar.disabled = false;
  }
}

// ========================================
// CAMBIAR ESTADO
// ========================================

async function cambiarEstado(id, estado, botonEstado) {
  botonEstado.disabled = true;

  try {
    const { error } = await supabase.rpc(
      "cambiar_estado_mecanico",
      {
        p_reparacion_id: id,
        p_estado: estado
      }
    );

    if (error) throw error;

    await cargarReparaciones();
  } catch (error) {
    console.error(error);
    alert("No se pudo cambiar el estado: " + error.message);
    botonEstado.disabled = false;
  }
}

// ========================================
// VER DETALLES Y PDF
// ========================================

function abrirDetalle(id, imprimir = false) {
  const url = new URL("trabajo-detalle.html", location.href);
  url.searchParams.set("id", id);

  if (imprimir) {
    url.searchParams.set("imprimir", "1");
  }

  window.open(url.href, "_blank", "noopener");
}

// ========================================
// CARGAR TRABAJOS REGISTRADOS
// ========================================

async function cargarReparaciones() {
  if (!usuarioActual) return;

  const lista = $("lista-reparaciones");
  const actualizar = $("actualizar");
  actualizar.disabled = true;

  try {
    const { data: trabajos, error } = await supabase
      .from("reparaciones")
      .select(`
        id,
        moto_id,
        descripcion,
        estado,
        fecha_ingreso,
        fecha_entrega,
        costo_mano_obra,
        mostrar_mano_obra
      `)
      .eq("mecanico_id", usuarioActual)
      .order("fecha_ingreso", { ascending: false })
      .limit(100);

    if (error) throw error;

    const reparaciones = trabajos || [];

    $("total-trabajos").textContent = reparaciones.length;
    $("trabajos-pendientes").textContent =
      reparaciones.filter(r => r.estado !== "finalizada").length;

    lista.replaceChildren();

    if (!reparaciones.length) {
      lista.appendChild(nodo("p", "No tienes trabajos registrados."));
      mensaje("mensaje", "");
      return;
    }

    const idsMotos = [...new Set(reparaciones.map(r => r.moto_id))];
    const idsTrabajos = reparaciones.map(r => r.id);

    const [resMotos, resAvances, resRepuestos] =
      await Promise.all([
        supabase
          .from("motocicletas")
          .select("id,placa,marca,modelo,foto_url")
          .in("id", idsMotos),

        supabase
          .from("avances_reparacion")
          .select("id,reparacion_id,descripcion,creado_en")
          .in("reparacion_id", idsTrabajos)
          .order("creado_en", { ascending: true }),

        supabase
          .from("repuestos_trabajo_mecanico")
          .select("id,reparacion_id,nombre,cantidad,precio_unitario")
          .in("reparacion_id", idsTrabajos)
      ]);

    if (resMotos.error) throw resMotos.error;
    if (resAvances.error) throw resAvances.error;
    if (resRepuestos.error) throw resRepuestos.error;

    const mapaMotos = new Map(
      (resMotos.data || []).map(m => [m.id, m])
    );

    for (const trabajo of reparaciones) {
      const moto = mapaMotos.get(trabajo.moto_id);
      const tarjeta = nodo("article", "", "reparacion");

      tarjeta.appendChild(
        nodo(
          "h3",
          moto
            ? `${moto.placa} — ${moto.marca} ${moto.modelo || ""}`
            : `Motocicleta #${trabajo.moto_id}`
        )
      );

      tarjeta.appendChild(
        nodo(
          "span",
          (trabajo.estado || "recibida").replaceAll("_", " "),
          `estado ${trabajo.estado}`
        )
      );

      dato(tarjeta, "Trabajo", trabajo.descripcion);
      dato(tarjeta, "Ingreso", fecha(trabajo.fecha_ingreso));

      if (trabajo.fecha_entrega) {
        dato(tarjeta, "Entrega", fecha(trabajo.fecha_entrega));
      }

      if (moto?.foto_url) {
        const { data: imagen } = await supabase.storage
          .from("fotos-motos")
          .createSignedUrl(moto.foto_url, 3600);

        if (imagen?.signedUrl) {
          const foto = document.createElement("img");
          foto.src = imagen.signedUrl;
          foto.alt = "Motocicleta";
          foto.loading = "lazy";
          tarjeta.appendChild(foto);
        }
      }

      const repuestos = (resRepuestos.data || []).filter(
        r => r.reparacion_id === trabajo.id
      );

      tarjeta.appendChild(nodo("h4", "🧰 Repuestos"));

      let totalRepuestos = 0;

      if (!repuestos.length) {
        tarjeta.appendChild(nodo("p", "Sin repuestos registrados."));
      } else {
        const envoltura = nodo(
          "div",
          "",
          "tabla-repuestos-contenedor"
        );

        const tabla = nodo("table", "", "tabla-repuestos");
        const cabecera = document.createElement("tr");

        for (const titulo of ["Repuesto", "Cantidad", "Precio", "Subtotal"]) {
          cabecera.appendChild(nodo("th", titulo));
        }

        tabla.appendChild(cabecera);

        for (const r of repuestos) {
          const subtotal = Number(r.cantidad) * Number(r.precio_unitario);
          totalRepuestos += subtotal;

          const fila = document.createElement("tr");

          for (const valor of [
            r.nombre,
            r.cantidad,
            dinero(r.precio_unitario),
            dinero(subtotal)
          ]) {
            fila.appendChild(nodo("td", valor));
          }

          tabla.appendChild(fila);
        }

        envoltura.appendChild(tabla);
        tarjeta.appendChild(envoltura);
      }

      const costos = nodo("div", "", "detalle-costos");

      function filaCosto(titulo, valor, clase = "") {
        const fila = nodo("div", "", `fila-total ${clase}`);
        fila.append(nodo("span", titulo), nodo("strong", valor));
        costos.appendChild(fila);
      }

      filaCosto("Repuestos", dinero(totalRepuestos));

      const mano = trabajo.mostrar_mano_obra
        ? Number(trabajo.costo_mano_obra || 0)
        : 0;

      if (trabajo.mostrar_mano_obra) {
        filaCosto("Mano de obra", dinero(mano));
      }

      filaCosto(
        "Total estimado",
        dinero(totalRepuestos + mano),
        "total-general"
      );

      tarjeta.appendChild(costos);
      tarjeta.appendChild(nodo("h4", "📋 Avances"));

      const avances = (resAvances.data || []).filter(
        a => a.reparacion_id === trabajo.id
      );

      if (!avances.length) {
        tarjeta.appendChild(nodo("p", "Sin avances registrados."));
      }

      for (const avance of avances) {
        const bloque = nodo("div", "", "avance");
        bloque.append(
          nodo("small", fecha(avance.creado_en)),
          nodo("p", avance.descripcion)
        );
        tarjeta.appendChild(bloque);
      }

      // INICIAR REPARACIÓN
      if (trabajo.estado === "recibida") {
        const iniciar = boton("🔧 Iniciar reparación", () => {
          cambiarEstado(trabajo.id, "en_reparacion", iniciar);
        });
        tarjeta.appendChild(iniciar);
      }

      // PUBLICAR AVANCES
      if (trabajo.estado !== "finalizada") {
        const formulario = document.createElement("form");
        const etiqueta = nodo("label", "¿Qué trabajo estás realizando?");
        const texto = document.createElement("textarea");
        texto.required = true;
        texto.placeholder = "Describe el avance de la reparación...";

        const publicar = nodo("button", "📢 Publicar avance");
        publicar.type = "submit";

        formulario.append(etiqueta, texto, publicar);

        formulario.addEventListener("submit", async e => {
          e.preventDefault();

          const descripcion = texto.value.trim();
          if (!descripcion) return;

          publicar.disabled = true;

          try {
            const { error } = await supabase
              .from("avances_reparacion")
              .insert({
                reparacion_id: trabajo.id,
                mecanico_id: usuarioActual,
                descripcion
              });

            if (error) throw error;
            await cargarReparaciones();
          } catch (error) {
            alert("Error al publicar avance: " + error.message);
            publicar.disabled = false;
          }
        });

        tarjeta.appendChild(formulario);
      }

      // FINALIZAR REPARACIÓN
      if (trabajo.estado === "en_reparacion") {
        const finalizar = boton("✅ Finalizar reparación", () => {
          if (!confirm("¿Marcar esta reparación como finalizada?")) return;
          cambiarEstado(trabajo.id, "finalizada", finalizar);
        });

        tarjeta.appendChild(finalizar);
      }

      // BOTONES DE OPCIONES
      const opciones = nodo("div", "", "opciones-trabajo");

      opciones.appendChild(
        boton("👁️ Ver detalles", () => abrirDetalle(trabajo.id))
      );

      // El PDF solamente se habilita cuando está finalizada.
      if (trabajo.estado === "finalizada") {
        opciones.appendChild(
          boton("📄 Descargar PDF", () => abrirDetalle(trabajo.id, true))
        );
      }

      const eliminar = boton(
        "🗑️ Eliminar",
        () => eliminarTrabajo(trabajo.id, eliminar),
        "boton-eliminar"
      );

      opciones.appendChild(eliminar);
      tarjeta.appendChild(opciones);
      lista.appendChild(tarjeta);
    }

    mensaje(
      "mensaje",
      `${reparaciones.length} trabajo(s) cargado(s).`
    );
  } catch (error) {
    console.error(error);
    mensaje(
      "mensaje",
      "Error al cargar trabajos: " + error.message,
      true
    );
  } finally {
    actualizar.disabled = false;
  }
}

// ========================================
// TIEMPO REAL
// ========================================

function solicitarActualizacion() {
  if (actualizacionPendiente) return;

  actualizacionPendiente = true;

  setTimeout(async () => {
    try {
      await cargarReparaciones();
    } finally {
      actualizacionPendiente = false;
    }
  }, 400);
}

function activarTiempoReal() {
  if (canalTiempoReal) return;

  canalTiempoReal = supabase
    .channel(`mecanico-panel-${usuarioActual}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reparaciones" },
      solicitarActualizacion
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "avances_reparacion" },
      solicitarActualizacion
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "repuestos_trabajo_mecanico" },
      solicitarActualizacion
    )
    .subscribe();
}

// ========================================
// ACTUALIZAR Y CERRAR SESIÓN
// ========================================

$("actualizar").addEventListener("click", async () => {
  await Promise.all([cargarMotos(), cargarReparaciones()]);
});

$("cerrar-sesion").addEventListener("click", async () => {
  const b = $("cerrar-sesion");
  b.disabled = true;

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Error al cerrar sesión: " + error.message);
    b.disabled = false;
    return;
  }

  location.replace("login.html");
});

calcularTotales();
iniciarPanel();
