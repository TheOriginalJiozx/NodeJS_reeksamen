export const createAllTables = `
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  fullname VARCHAR(350) DEFAULT NULL,
  username VARCHAR(350) NOT NULL,
  email VARCHAR(500) NOT NULL,
  password_hash VARCHAR(500) NOT NULL,
  role VARCHAR(45) NOT NULL DEFAULT 'user',
  PRIMARY KEY (id),
  UNIQUE KEY username_UNIQUE (username),
  UNIQUE KEY email_UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS types (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
);

CREATE TABLE IF NOT EXISTS resources (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  owner VARCHAR(500) NOT NULL,
  image TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_resources_owner (owner)
);

CREATE TABLE IF NOT EXISTS availabilities (
  id INT NOT NULL AUTO_INCREMENT,
  resource_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_availabilities_resource (resource_id, start_date),
  CONSTRAINT fk_availability_resource FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT NOT NULL AUTO_INCREMENT,
  resource_id INT NOT NULL,
  booker VARCHAR(255) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  confirmed TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comment TEXT DEFAULT NULL,
  image VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_bookings_resource (resource_id, end_date),
  CONSTRAINT fk_bookings_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE ON UPDATE CASCADE
);
`;
