export const getAllBrands = `SELECT id, name FROM car_brands ORDER BY name`;
export const getBrandById = `SELECT id, name FROM car_brands WHERE id = ?`;
export const getModelsByBrandId = `SELECT id, name FROM car_models WHERE brand_id = ? ORDER BY name`;
export const getAllModels = `SELECT id, brand_id, name FROM car_models ORDER BY brand_id, name`;
