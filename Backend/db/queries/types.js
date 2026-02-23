export const getTypes = `SELECT id, name FROM types ORDER BY name`;
export const selectTypeNameById = `SELECT name FROM types WHERE id = ?`;