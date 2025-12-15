CREATE TABLE IF NOT EXISTS `user` (
  id INT AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  bingo_id INT NOT NULL UNIQUE,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bingo` (
  id INT AUTO_INCREMENT,
  seed JSON NOT NULL,
  punch JSON NOT NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `question` (
  id INT AUTO_INCREMENT,
  content VARCHAR(255) NOT NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `correct_answer` (
  id INT AUTO_INCREMENT,
  question_id INT NOT NULL,
  choice_id INT NOT NULL,

  PRIMARY KEY (id),
  KEY idx_correct_question (question_id),
  KEY idx_correct_choice (choice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `choice` (
  id INT AUTO_INCREMENT,
  content VARCHAR(255) NOT NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_answer` (
  id INT AUTO_INCREMENT,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  choice_id INT NOT NULL,

  PRIMARY KEY (id),
  -- enforce: user can answer each question at most once
  UNIQUE KEY uq_user_question (user_id, question_id),
  KEY idx_user_answer_user (user_id),
  KEY idx_user_answer_question (question_id),
  KEY idx_user_answer_choice (choice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `correct_answer`
  ADD CONSTRAINT fk_correct_question FOREIGN KEY (question_id) REFERENCES `question`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_correct_choice   FOREIGN KEY (choice_id)   REFERENCES `choice`(id)   ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_answer`
  ADD CONSTRAINT fk_user_answer_user     FOREIGN KEY (user_id)     REFERENCES `user`(id)     ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_user_answer_question FOREIGN KEY (question_id) REFERENCES `question`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_user_answer_choice   FOREIGN KEY (choice_id)   REFERENCES `choice`(id)   ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `user`
  ADD CONSTRAINT fk_user_bingo FOREIGN KEY (bingo_id) REFERENCES `bingo`(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER USER 'kbtxdb'@'%' IDENTIFIED WITH mysql_native_password BY 'password';
FLUSH PRIVILEGES;

INSERT INTO `choice` (content) VALUES
  ('A'), ('B'), ('C'), ('D'), ('E'),
  ('F'), ('G'), ('H'), ('I'), ('J'),
  ('K'), ('L'), ('M'), ('N'), ('O'),
  ('P'), ('Q'), ('R'), ('S'), ('T'),
  ('U'), ('V'), ('W'), ('Y'), ('Z');