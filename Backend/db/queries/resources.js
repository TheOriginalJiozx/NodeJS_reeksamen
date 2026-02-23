export const getAllResources = `SELECT id, name, type, owner, image FROM resources WHERE owner != ? ORDER BY name`;
export const getOwnedResources = `SELECT id, name, type, owner, image FROM resources WHERE owner = ? ORDER BY name`;
export const insertResource = `INSERT INTO resources (name, type, owner) VALUES (?, ?, ?)`;
export const updateResourceImage = `UPDATE resources SET image = ? WHERE id = ?`;

export const selectResourceOwner = `SELECT owner FROM resources WHERE id = ?`;
export const selectResourceImage = `SELECT image FROM resources WHERE id = ?`;
export const selectResourceById = `SELECT id FROM resources WHERE id = ?`;
export const deleteResource = `DELETE FROM resources WHERE id = ?`;

export const availabilitiesForResource = `SELECT id, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
                 FROM availabilities
                 WHERE resource_id = ?
                 ORDER BY start_date`;

export const bookingsForResource = `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate FROM bookings WHERE resource_id = ? ORDER BY start_date`;

export const insertAvailability = `INSERT INTO availabilities (resource_id, start_date, end_date) VALUES (?, ?, ?)`;

export const deleteBookingsByResource = `DELETE FROM bookings WHERE resource_id = ?`;
export const deleteAvailabilitiesByResource = `DELETE FROM availabilities WHERE resource_id = ?`;
