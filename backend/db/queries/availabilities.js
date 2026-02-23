export const getAvailabilitiesForResource = `SELECT start_date AS startDate, end_date AS endDate FROM availabilities WHERE resource_id = ? ORDER BY start_date`;
export const getAllAvailabilities = `SELECT start_date AS startDate, end_date AS endDate, resource_id FROM availabilities ORDER BY resource_id, start_date`;
export const insertAvailability = `INSERT INTO availabilities (resource_id, start_date, end_date) VALUES (?, ?, ?)`;
export const selectAvailabilityById = `SELECT id, resource_id, start_date, end_date FROM availabilities WHERE id = ?`;
export const deleteAvailabilityById = `DELETE FROM availabilities WHERE id = ?`;

export const getAvailabilitiesForOwnerResources = `SELECT resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
						  FROM availabilities
						  WHERE resource_id IN (SELECT id FROM resources WHERE owner = ?)
							  ORDER BY start_date`;
