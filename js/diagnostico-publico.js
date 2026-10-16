
import { supabase } from "./supabase.js";

// ==========================================
// DIAGNÓSTICO PÚBLICO - LUIGI BIKER
// SOLO CONSULTAS, NO MODIFICA DATOS
// ==========================================

const $ = id => document.getElementById(id);

function mostrar(id, informacion) {
  $(id).textContent =
    typeof informacion === "string"
      ? informacion
      : JSON.stringify(informacion, null, 2);
}

function describirError(error) {
  return {
    mensaje: error?.message || "Error desconocido",
    codigo: error?.code || "Sin código",
    detalle: error?.details || "",
    sugerencia: error?.hint || ""
  };
}

// ==========================================
// 1. COMPROBAR CONEXIÓN
// ==========================================

async function probarConexion() {
  mostrar(
    "conexion",
    "Consultando la conexión con Supabase..."
  );

  try {
    if (!supabase) {
      throw new Error(
        "No se importó correctamente Supabase."
      );
    }

    // No usamos auth.getUser(), porque la página
    // pública no necesita iniciar sesión.
    const { data, error } = await supabase.rpc(
      "consultar_catalogo_publico"
    );

    if (error) {
      mostrar("conexion", {
        resultado: "ERROR EN CONSULTA PÚBLICA",
        error: describirError(error)
      });
      return;
    }

    mostrar("conexion", {
      resultado: "CONEXIÓN Y FUNCIÓN CORRECTAS",
      productos_recibidos:
        Array.isArray(data) ? data.length : 0
    });

  } catch (error) {
    mostrar("conexion", {
      resultado: "ERROR",
      error: describirError(error)
    });
  }
}

// ==========================================
// 2. COMPROBAR BÚSQUEDA POR PLACA
// ==========================================

async function probarMoto() {
  const placa = $("placa").value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!placa) {
    mostrar(
      "resultado-moto",
      "Debes escribir una placa."
    );
    return;
  }

  mostrar(
    "resultado-moto",
    "Buscando motocicleta..."
  );

  try {
    const { data, error } = await supabase.rpc(
      "consultar_seguimiento_publico",
      {
        p_placa: placa
      }
    );

    if (error) {
      mostrar("resultado-moto", {
        resultado: "ERROR",
        error: describirError(error)
      });
      return;
    }

    if (!data?.encontrada) {
      mostrar("resultado-moto", {
        resultado: "NO ENCONTRADA",
        placa_consultada: placa,
        explicacion:
          "La función respondió, pero no encontró " +
          "una motocicleta con esta placa."
      });
      return;
    }

    mostrar("resultado-moto", {
      resultado: "MOTOCICLETA ENCONTRADA",
      placa: data.moto?.placa,
      marca: data.moto?.marca,
      modelo: data.moto?.modelo,
      ruta_foto_registrada:
        data.moto?.foto_url || null,
      estado_reparacion:
        data.reparacion?.estado || null,
      cantidad_avances:
        data.avances?.length || 0,
      cantidad_repuestos:
        data.repuestos?.length || 0
    });

  } catch (error) {
    mostrar("resultado-moto", {
      resultado: "ERROR",
      error: describirError(error)
    });
  }
}

// ==========================================
// 3. COMPROBAR CATÁLOGO
// ==========================================

async function probarCatalogo() {
  mostrar(
    "resultado-catalogo",
    "Consultando catálogo..."
  );

  try {
    const { data, error } = await supabase.rpc(
      "consultar_catalogo_publico"
    );

    if (error) {
      mostrar("resultado-catalogo", {
        resultado: "ERROR",
        error: describirError(error)
      });
      return;
    }

    const lista = Array.isArray(data) ? data : [];

    mostrar("resultado-catalogo", {
      resultado: "CONSULTA CORRECTA",
      productos_disponibles: lista.length,
      primeros_productos: lista
        .slice(0, 5)
        .map(producto => ({
          nombre: producto.nombre,
          categoria: producto.categoria,
          precio: producto.precio,
          stock: producto.stock
        }))
    });

  } catch (error) {
    mostrar("resultado-catalogo", {
      resultado: "ERROR",
      error: describirError(error)
    });
  }
}

// ==========================================
// EVENTOS
// ==========================================

$("probar-moto").addEventListener(
  "click",
  probarMoto
);

$("probar-catalogo").addEventListener(
  "click",
  probarCatalogo
);

// ==========================================
// INICIO
// ==========================================

probarConexion();
