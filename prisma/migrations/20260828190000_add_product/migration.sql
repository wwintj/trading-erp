-- CreateTable
CREATE TABLE `product` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `specification` VARCHAR(255) NULL,
    `unit` VARCHAR(32) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
