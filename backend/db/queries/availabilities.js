export const getAvailabilitiesForResource = `SELECT start_date AS startDate, end_date AS endDate FROM availabilities WHERE resource_id = ? ORDER BY start_date`;
export const insertAvailability = `INSERT INTO availabilities (resource_id, start_date, end_date) VALUES (?, ?, ?)`;
export const selectAvailabilityById = `SELECT id, resource_id AS resourceId, start_date AS startDate, end_date AS endDate FROM availabilities WHERE id = ?`;
export const updateAvailabilityById = `UPDATE availabilities SET start_date = ?, end_date = ? WHERE id = ?`;
export const deleteAvailabilityById = `DELETE FROM availabilities WHERE id = ?`;
export const checkAvailabilityOverlap = `SELECT 1 FROM availabilities WHERE resource_id = ? AND NOT (end_date < ? OR start_date > ?)`;

export const getAvailabilitiesForOwnerResources = `SELECT resource_id, start_date, end_date
						  FROM availabilities
						  WHERE resource_id IN (SELECT id FROM resources WHERE owner = ?)
							  ORDER BY start_date`;
