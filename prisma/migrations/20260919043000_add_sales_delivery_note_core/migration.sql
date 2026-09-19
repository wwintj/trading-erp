-- CreateTable
CREATE TABLE `sales_delivery_note` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryNo` VARCHAR(64) NOT NULL,
    `status` ENUM('DRAFT', 'FINAL', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `deliveryDate` DATE NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `customer_po_no` VARCHAR(128) NULL,
    `sender_legal_name` VARCHAR(255) NOT NULL,
    `sender_contact_name` VARCHAR(128) NULL,
    `sender_phone` VARCHAR(64) NULL,
    `sender_address` TEXT NULL,
    `customer_legal_name` VARCHAR(255) NOT NULL,
    `delivery_contact_name` VARCHAR(128) NULL,
    `delivery_contact_phone` VARCHAR(64) NULL,
    `delivery_address` TEXT NULL,
    `shipping_method` VARCHAR(255) NULL,
    `logistics_company` VARCHAR(255) NULL,
    `tracking_no` VARCHAR(128) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_delivery_note_deliveryNo_key`(`deliveryNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `sales_delivery_note_item` (
    `id` VARCHAR(191) NOT NULL,
    `salesDeliveryNoteId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `productCode` VARCHAR(64) NOT NULL,
    `productName` VARCHAR(255) NOT NULL,
    `specification` VARCHAR(255) NULL,
    `unit` VARCHAR(32) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `remark` TEXT NULL,

    INDEX `sales_delivery_note_item_salesDeliveryNoteId_sortOrder_idx`(`salesDeliveryNoteId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `sales_delivery_note` ADD CONSTRAINT `sales_delivery_note_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_delivery_note` ADD CONSTRAINT `sales_delivery_note_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_delivery_note_item` ADD CONSTRAINT `sales_delivery_note_item_salesDeliveryNoteId_fkey` FOREIGN KEY (`salesDeliveryNoteId`) REFERENCES `sales_delivery_note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_delivery_note_item` ADD CONSTRAINT `sales_delivery_note_item_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
