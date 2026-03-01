export const markResourceDefect = `
  INSERT INTO defect_resources (resource_id, resource_name, resource_owner, booker_id)
  VALUES (?, ?, ?, ?)
`;

export const isResourceDefect = `
  SELECT id FROM defect_resources WHERE resource_id = ? LIMIT 1
`;

export const getDefectResourcesForBooker = `
  SELECT 
    dr.id,
    dr.resource_id,
    dr.resource_name,
    dr.resource_owner,
    dr.seen,
    dr.created_at,
    COUNT(DISTINCT b.id) as booking_count
  FROM defect_resources dr
  LEFT JOIN bookings b ON dr.resource_id = b.resource_id
  WHERE dr.booker_id = ?
  GROUP BY dr.id, dr.resource_id, dr.resource_name, dr.resource_owner, dr.seen, dr.created_at
  ORDER BY dr.created_at DESC
`;

export const getDefectResourcesForUserBookings = `
  SELECT COUNT(DISTINCT dr.id) as defect_count
  FROM defect_resources dr
  WHERE dr.booker_id = ? AND dr.seen = FALSE
`;

export const markDefectResourceAsSeen = `
  UPDATE defect_resources
  SET seen = TRUE
  WHERE id = ? AND booker_id = ?
`;

export const removeDefectResource = `
  DELETE FROM defect_resources WHERE resource_id = ?
`;

export const getUserIdByFullname = `
  SELECT id FROM users WHERE fullname = ? LIMIT 1
`;
