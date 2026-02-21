export const findUserByEmail = `SELECT * FROM users WHERE email = $1`;
export const findUserByUsername = `SELECT * FROM users WHERE username = $1`;
export const selectUserById = `SELECT id, fullname, username, email, role FROM users WHERE id = $1`;
export const insertUser = `INSERT INTO users (fullname, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`;
export const deleteUserById = `DELETE FROM users WHERE id = $1`;

export const updateUsername = `UPDATE users SET username = $1 WHERE id = $2`;
export const updatePasswordHash = `UPDATE users SET password_hash = $1 WHERE id = $2`;
export const updateBookingsBooker = `UPDATE bookings SET booker = $1 WHERE booker = $2`;
export const updateResourcesOwner = `UPDATE resources SET owner = $1 WHERE owner = $2`;

export const selectUserForLogin = `SELECT * FROM users WHERE username = $1`;
export const selectImagesByOwner = `SELECT image FROM resources WHERE owner = $1`;
export const deleteBookingsByOwnerResources = `DELETE FROM bookings WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)`;
export const deleteAvailabilitiesByOwnerResources = `DELETE FROM availabilities WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)`;
export const deleteResourcesByOwner = `DELETE FROM resources WHERE owner = $1`;
