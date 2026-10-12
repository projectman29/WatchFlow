import { prisma } from './prisma';

export async function isSalesDataFoundationReady(): Promise<boolean> {
  const [result] = await prisma.$queryRaw<Array<{ ready: boolean }>>`
    SELECT
      to_regclass('public."LeadStatusHistory"') IS NOT NULL
      AND to_regclass('public."OrderPayment"') IS NOT NULL
      AND to_regclass('public."OrderDirectCost"') IS NOT NULL
      AND (
        SELECT COUNT(*) = 4
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Order'
          AND column_name IN (
            'currency',
            'attributedSalesEmployeeId',
            'attributedSalesName',
            'attributedSalesEmail'
          )
      ) AS ready
  `;

  return result.ready;
}
