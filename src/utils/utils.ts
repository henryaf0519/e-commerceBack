import { DistanceUnitEnum, WeightUnitEnum } from 'shippo';

export interface ParcelDimensions {
  length: number | string;
  width: number | string;
  height: number | string;
  weight: number | string;
  quantity?: number;
  // Aceptamos estos campos opcionales para que no falle el paso de parámetros,
  // pero la función los ignorará y forzará IN/LB.
  distance_unit?: string;
  distanceUnit?: string;
  mass_unit?: string;
  massUnit?: string;
}

/**
 * Calcula una "Caja Maestra" y fuerza las unidades a Pulgadas (in) y Libras (lb).
 */
export function calculateConsolidatedParcel(parcels: ParcelDimensions[]) {
  let maxLength = 0;
  let maxWidth = 0;
  let totalHeight = 0;
  let totalWeight = 0;

  // REGLA DE ORO: Siempre usamos estos Enums
  // Esto soluciona el error: "Type string is not assignable to WeightUnitEnum"
  const FORCED_DISTANCE = DistanceUnitEnum.In;
  const FORCED_MASS = WeightUnitEnum.Lb;

  if (!parcels || parcels.length === 0) {
    return {
      length: '0',
      width: '0',
      height: '0',
      weight: '0',
      distanceUnit: FORCED_DISTANCE,
      massUnit: FORCED_MASS,
    };
  }

  parcels.forEach((item) => {
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;

    // Asumimos que los valores numéricos YA VIENEN en in/lb
    const len = Number(item.length) || 0;
    const wid = Number(item.width) || 0;
    const hgt = Number(item.height) || 0;
    const wgt = Number(item.weight) || 0;

    // 1. Base más grande
    if (len > maxLength) maxLength = len;
    if (wid > maxWidth) maxWidth = wid;

    // 2. Altura acumulada
    totalHeight += hgt * quantity;

    // 3. Peso acumulado
    totalWeight += wgt * quantity;
  });

  // Retornamos el objeto perfectamente tipado para el SDK
  return {
    length: String(maxLength),
    width: String(maxWidth),
    height: String(totalHeight),
    weight: String(totalWeight),
    distanceUnit: FORCED_DISTANCE, // Es de tipo DistanceUnitEnum (in)
    massUnit: FORCED_MASS, // Es de tipo WeightUnitEnum (lb)
  };
}
