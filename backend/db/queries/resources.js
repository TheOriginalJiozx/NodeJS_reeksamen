export const getAllResources = `SELECT id, name, type, owner, image FROM resources WHERE owner != ? ORDER BY name`;
export const getOwnedResources = `SELECT id, name, type, owner, image FROM resources WHERE owner = ? ORDER BY name`;
export const insertResource = `INSERT INTO resources (name, type, owner) VALUES (?, ?, ?)`;
export const updateResourceImage = `UPDATE resources SET image = ? WHERE id = ?`;
export const updateResourceOwner = `UPDATE resources SET owner = ? WHERE owner = ?`;

export const selectResourceOwner = `SELECT owner FROM resources WHERE id = ?`;
export const selectResourceImage = `SELECT image, name, owner FROM resources WHERE id = ?`;
export const selectResourceById = `SELECT id FROM resources WHERE id = ?`;
export const deleteResource = `DELETE FROM resources WHERE id = ?`;

export const availabilitiesForResource = `SELECT id, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
                 FROM availabilities
                 WHERE resource_id = ?
                 ORDER BY start_date`;

export const bookingsForResource = `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate FROM bookings WHERE resource_id = ? ORDER BY start_date`;

export const deleteBookingsByResource = `DELETE FROM bookings WHERE resource_id = ?`;
export const deleteAvailabilitiesByResource = `DELETE FROM availabilities WHERE resource_id = ?`;
