-- CreateTable
CREATE TABLE `customer` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `legalName` VARCHAR(255) NOT NULL,
    `shortName` VARCHAR(255) NULL,
    `unifiedCreditCode` VARCHAR(64) NULL,
    `contactName` VARCHAR(128) NULL,
    `phone` VARCHAR(64) NULL,
    `email` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `default_delivery_contact_name` VARCHAR(128) NULL,
    `default_delivery_phone` VARCHAR(64) NULL,
    `default_delivery_address` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
