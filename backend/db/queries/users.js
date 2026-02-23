export const findUserByEmail = `SELECT * FROM users WHERE email = ?`;
export const findUserByUsername = `SELECT * FROM users WHERE username = ?`;
export const selectUserById = `SELECT id, fullname, username, email, role FROM users WHERE id = ?`;
export const insertUser = `INSERT INTO users (fullname, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`;
export const deleteUserById = `DELETE FROM users WHERE id = ?`;

export const updateUsername = `UPDATE users SET username = ? WHERE id = ?`;
export const updatePasswordHash = `UPDATE users SET password_hash = ? WHERE id = ?`;
export const updateBookingsBooker = `UPDATE bookings SET booker = ? WHERE booker = ?`;
export const updateResourcesOwner = `UPDATE resources SET owner = ? WHERE owner = ?`;

export const selectUserForLogin = `SELECT id, username, fullname, email, role, password_hash AS passwordHash FROM users WHERE username = ?`;
export const selectImagesByOwner = `SELECT image FROM resources WHERE owner = ?`;
export const deleteBookingsByOwnerResources = `DELETE FROM bookings WHERE resource_id IN (SELECT id FROM resources WHERE owner = ?)`;
export const deleteAvailabilitiesByOwnerResources = `DELETE FROM availabilities WHERE resource_id IN (SELECT id FROM resources WHERE owner = ?)`;
export const deleteResourcesByOwner = `DELETE FROM resources WHERE owner = ?`;
