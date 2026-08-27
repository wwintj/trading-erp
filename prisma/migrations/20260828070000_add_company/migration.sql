-- CreateTable
CREATE TABLE `company` (
    `id` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(255) NOT NULL,
    `shortName` VARCHAR(255) NULL,
    `unifiedCreditCode` VARCHAR(64) NULL,
    `contactName` VARCHAR(128) NULL,
    `phone` VARCHAR(64) NULL,
    `email` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `bankName` VARCHAR(255) NULL,
    `bankAccount` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
