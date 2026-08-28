-- CreateTable
CREATE TABLE `purchase_contract` (
    `id` VARCHAR(191) NOT NULL,
    `contractNo` VARCHAR(64) NOT NULL,
    `status` ENUM('DRAFT', 'FINAL', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `signingDate` DATE NOT NULL,
    `signingPlace` VARCHAR(255) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `buyerLegalName` VARCHAR(255) NOT NULL,
    `buyerUnifiedCreditCode` VARCHAR(64) NULL,
    `buyerContactName` VARCHAR(128) NULL,
    `buyerPhone` VARCHAR(64) NULL,
    `buyerAddress` TEXT NULL,
    `buyerBankName` VARCHAR(255) NULL,
    `buyerBankAccount` VARCHAR(128) NULL,
    `sellerLegalName` VARCHAR(255) NOT NULL,
    `sellerUnifiedCreditCode` VARCHAR(64) NULL,
    `sellerContactName` VARCHAR(128) NULL,
    `sellerPhone` VARCHAR(64) NULL,
    `sellerAddress` TEXT NULL,
    `sellerBankName` VARCHAR(255) NULL,
    `sellerBankAccount` VARCHAR(128) NULL,
    `deliveryDate` DATE NULL,
    `deliveryAddress` TEXT NULL,
    `deliveryContactName` VARCHAR(128) NULL,
    `deliveryContactPhone` VARCHAR(64) NULL,
    `packagingTerms` TEXT NULL,
    `inspectionTerms` TEXT NULL,
    `paymentTerms` TEXT NULL,
    `shippingMethod` TEXT NULL,
    `breachTerms` TEXT NULL,
    `qualityTerms` TEXT NULL,
    `changeTerms` TEXT NULL,
    `disputeTerms` TEXT NULL,
    `additionalTerms` TEXT NULL,
    `totalAmount` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_contract_contractNo_key`(`contractNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `purchase_contract_item` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseContractId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `productCode` VARCHAR(64) NOT NULL,
    `productName` VARCHAR(255) NOT NULL,
    `specification` VARCHAR(255) NULL,
    `unit` VARCHAR(32) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,

    INDEX `purchase_contract_item_purchaseContractId_sortOrder_idx`(`purchaseContractId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `purchase_contract` ADD CONSTRAINT `purchase_contract_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_contract` ADD CONSTRAINT `purchase_contract_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_contract_item` ADD CONSTRAINT `purchase_contract_item_purchaseContractId_fkey` FOREIGN KEY (`purchaseContractId`) REFERENCES `purchase_contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_contract_item` ADD CONSTRAINT `purchase_contract_item_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
