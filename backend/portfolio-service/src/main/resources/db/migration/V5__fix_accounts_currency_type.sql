-- Hibernate validates String @Column(length=3) as VARCHAR, not CHAR (bpchar).
-- Alter to VARCHAR(3) to match the JPA entity mapping.
ALTER TABLE accounts ALTER COLUMN currency TYPE VARCHAR(3);
