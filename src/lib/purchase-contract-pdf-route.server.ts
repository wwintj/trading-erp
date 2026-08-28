import "server-only";

import { getCurrentSession } from "@/lib/auth-session";
import {
  PurchaseContractPdfIntegrityError,
  buildPurchaseContractPdfViewModel,
  purchaseContractPdfContentDisposition,
} from "@/lib/purchase-contract-pdf";
import {
  PurchaseContractPdfFontError,
  renderPurchaseContractPdf,
  resolvePurchaseContractPdfFontPath,
} from "@/lib/purchase-contract-pdf.server";
import { getPurchaseContractById } from "@/lib/purchase-contract.server";

type PdfRouteDependencies = {
  getSession: typeof getCurrentSession;
  getContract: typeof getPurchaseContractById;
  resolveFont: typeof resolvePurchaseContractPdfFontPath;
  renderPdf: typeof renderPurchaseContractPdf;
};

const defaultDependencies: PdfRouteDependencies = {
  getSession: getCurrentSession,
  getContract: getPurchaseContractById,
  resolveFont: resolvePurchaseContractPdfFontPath,
  renderPdf: renderPurchaseContractPdf,
};

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function getPurchaseContractPdfResponse(
  request: Request,
  contractId: string,
  dependencies: PdfRouteDependencies = defaultDependencies,
): Promise<Response> {
  const session = await dependencies.getSession();
  if (!session) {
    return Response.redirect(new URL("/login", request.url), 307);
  }

  let contract;
  try {
    contract = await dependencies.getContract(contractId);
  } catch {
    return textResponse("采购合同信息暂时无法加载，请稍后重试。", 500);
  }

  if (!contract) {
    return textResponse("采购合同不存在。", 404);
  }
  if (contract.status !== "FINAL") {
    return textResponse("仅已定稿的采购合同可以导出 PDF。", 409);
  }

  try {
    const model = buildPurchaseContractPdfViewModel(contract);
    const fontPath = await dependencies.resolveFont();
    const pdf = await dependencies.renderPdf(model, fontPath);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": purchaseContractPdfContentDisposition(
          contract.contractNo,
        ),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof PurchaseContractPdfIntegrityError) {
      return textResponse("采购合同金额数据不一致，无法导出 PDF。", 409);
    }
    if (error instanceof PurchaseContractPdfFontError) {
      return textResponse("采购合同 PDF 字体不可用，请联系管理员。", 503);
    }
    return textResponse("采购合同 PDF 生成失败，请稍后重试。", 500);
  }
}
