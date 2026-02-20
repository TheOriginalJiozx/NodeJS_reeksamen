export const getBookingsForResource = `SELECT id, booker, resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, comment, image, confirmed FROM bookings WHERE resource_id = $1 ORDER BY start_date`;
export const getAllBookings = `SELECT id, booker, resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, comment, image, confirmed FROM bookings ORDER BY start_date`;

export const checkAvailabilityExists = `SELECT 1 FROM availabilities WHERE resource_id = $1 AND start_date <= $2 AND end_date >= $3`;
export const checkBookingConflict = `SELECT 1 FROM bookings WHERE resource_id = $1 AND NOT (end_date < $2 OR start_date > $3)`;
export const checkConfirmedBookingConflict = `SELECT 1 FROM bookings WHERE resource_id = $1 AND confirmed = 1 AND NOT (end_date < $2 OR start_date > $3)`;

export const insertBooking = `INSERT INTO bookings (booker, resource_id, start_date, end_date, comment) VALUES ($1, $2, $3, $4, $5)`;
export const selectImageForResource = `SELECT image FROM resources WHERE id = $1`;
export const updateBookingImage = `UPDATE bookings SET image = $1 WHERE id = $2`;
export const deleteBookingById = `DELETE FROM bookings WHERE id = $1`;
export const selectBookingById = `SELECT id, booker, resource_id FROM bookings WHERE id = $1`;

export const confirmBookingById = `UPDATE bookings SET confirmed = 1 WHERE id = $1`;
export const declineBookingById = `UPDATE bookings SET confirmed = 2 WHERE id = $1`;

export const getBookingsForUserOrOwner = `SELECT b.id, b.booker, b.resource_id, DATE_FORMAT(b.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(b.end_date, '%Y-%m-%d') AS end_date, b.comment
									FROM bookings b
									LEFT JOIN resources r ON b.resource_id = r.id
									WHERE $1 IN (b.booker, r.owner)
									ORDER BY start_date`;

export const checkActiveBookingsForOwner = `SELECT 1 FROM bookings b JOIN resources r ON b.resource_id = r.id WHERE r.owner = $1 AND (b.end_date IS NULL OR DATE(b.end_date) >= CURRENT_DATE) LIMIT 1`;
