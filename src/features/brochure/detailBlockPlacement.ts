import type {Product,Placement}from '../../domain/models';
const number = (value:unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function detailBlockPlacement(value:Placement = {}) {
  return {
    x: number(value.x),
    y: number(value.y),
    ...(value.width !== undefined ? { width: Math.max(5, Math.min(150, number(value.width, 100))) } : {}),
    ...(value.height !== undefined ? { height: Math.max(.5, Math.min(100, number(value.height, 5))) } : {}),
  };
}

export function detailBlockStyle(value?:Placement) {
  const placement = detailBlockPlacement(value);
  return {
    transform: `translate(${placement.x}cqw, ${placement.y}cqw)`,
    ...(placement.width !== undefined ? { width: `${placement.width}%`, maxWidth: "none", flex: "none" } : {}),
    ...(placement.height !== undefined ? { height: `${placement.height}cqw`, minHeight: `${placement.height}cqw`, flex: "none" } : {}),
  };
}

export function updateDetailBlockPlacements(product: Product, key:string|number, placement:Placement) {
  return { ...(product.detailBlockPlacements || {}), [String(key)]: detailBlockPlacement(placement) };
}
