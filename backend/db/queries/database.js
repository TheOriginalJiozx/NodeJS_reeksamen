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
  seen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comment TEXT DEFAULT NULL,
  defect_reported VARCHAR(500) DEFAULT NULL,
  defect_image VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_bookings_resource (resource_id, end_date),
  CONSTRAINT fk_bookings_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS reserved_usernames (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(350) NOT NULL,
  reserved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY username_UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS car_brands (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
);

CREATE TABLE IF NOT EXISTS car_models (
  id INT NOT NULL AUTO_INCREMENT,
  brand_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_car_models_brand (brand_id),
  UNIQUE KEY unique_brand_model (brand_id, name),
  CONSTRAINT fk_car_models_brand FOREIGN KEY (brand_id) REFERENCES car_brands (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS defect_resources (
  id INT NOT NULL AUTO_INCREMENT,
  resource_id INT NOT NULL,
  resource_name VARCHAR(255),
  resource_owner VARCHAR(350),
  booker_id INT,
  seen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_defect_resources_resource (resource_id),
  KEY idx_defect_resources_booker (booker_id)
);
`;
