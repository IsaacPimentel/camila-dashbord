import { prisma } from '../lib/prisma.js';

function safeBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [accounts, suppliers, campaigns, quickTasks] = await Promise.all([
        prisma.account.findMany({ orderBy: { name: 'asc' } }),
        prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
        prisma.campaign.findMany({
          include: {
            account: true,
            checklist: true,
            sunatItems: true,
            pendings: { include: { supplier: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.quickTask.findMany({
          include: { account: true, campaign: true },
          orderBy: { dueDate: 'asc' },
        }),
      ]);

      return res.status(200).json({ accounts, suppliers, campaigns, quickTasks });
    }

    if (req.method === 'POST') {
      const payload = safeBody(req);
      const data = {
        accounts: payload.accounts || [],
        suppliers: payload.suppliers || [],
        campaigns: payload.campaigns || [],
        checklist: payload.checklist || [],
        sunat: payload.sunat || [],
        pendings: payload.pendings || [],
        quickTasks: payload.quickTasks || [],
      };

      const [accountResult, supplierResult] = await Promise.all([
        Promise.all(
          data.accounts.map((account) =>
            prisma.account.upsert({
              where: { id: account.id },
              update: { name: account.name },
              create: { id: account.id, name: account.name },
            })
          )
        ),
        Promise.all(
          data.suppliers.map((supplier) =>
            prisma.supplier.upsert({
              where: { id: supplier.id },
              update: { name: supplier.name },
              create: { id: supplier.id, name: supplier.name },
            })
          )
        ),
      ]);

      await Promise.all(
        data.campaigns.map((campaign) =>
          prisma.campaign.upsert({
            where: { id: campaign.id },
            update: {
              accountId: campaign.accountId,
              name: campaign.name,
              elemento: campaign.elemento || '',
              startDate: campaign.startDate,
              endDate: campaign.endDate || null,
              stage: campaign.stage || 'no_implementado',
              cotizacionAprobada: Boolean(campaign.cotizacionAprobada),
              ordenCompra: Boolean(campaign.ordenCompra),
              facturado: Boolean(campaign.facturado),
            },
            create: {
              id: campaign.id,
              accountId: campaign.accountId,
              name: campaign.name,
              elemento: campaign.elemento || '',
              startDate: campaign.startDate,
              endDate: campaign.endDate || null,
              stage: campaign.stage || 'no_implementado',
              cotizacionAprobada: Boolean(campaign.cotizacionAprobada),
              ordenCompra: Boolean(campaign.ordenCompra),
              facturado: Boolean(campaign.facturado),
            },
          })
        )
      );

      await Promise.all(
        data.checklist.map((item) =>
          prisma.checklistItem.upsert({
            where: { id: item.id },
            update: { text: item.text, category: item.category, done: Boolean(item.done), campaignId: item.campaignId },
            create: { id: item.id, text: item.text, category: item.category, done: Boolean(item.done), campaignId: item.campaignId },
          })
        )
      );

      await Promise.all(
        data.sunat.map((item) =>
          prisma.sunatItem.upsert({
            where: { id: item.id },
            update: { text: item.text, done: Boolean(item.done), campaignId: item.campaignId },
            create: { id: item.id, text: item.text, done: Boolean(item.done), campaignId: item.campaignId },
          })
        )
      );

      await Promise.all(
        data.pendings.map((item) =>
          prisma.pendingItem.upsert({
            where: { id: item.id },
            update: {
              description: item.description,
              expectedDate: item.expectedDate,
              done: Boolean(item.done),
              campaignId: item.campaignId,
              supplierId: item.supplierId,
            },
            create: {
              id: item.id,
              description: item.description,
              expectedDate: item.expectedDate,
              done: Boolean(item.done),
              campaignId: item.campaignId,
              supplierId: item.supplierId,
            },
          })
        )
      );

      await Promise.all(
        data.quickTasks.map((task) =>
          prisma.quickTask.upsert({
            where: { id: task.id },
            update: {
              accountId: task.accountId,
              text: task.text,
              dueDate: task.dueDate || null,
              done: Boolean(task.done),
              campaignId: task.campaignId || null,
            },
            create: {
              id: task.id,
              accountId: task.accountId,
              text: task.text,
              dueDate: task.dueDate || null,
              done: Boolean(task.done),
              campaignId: task.campaignId || null,
            },
          })
        )
      );

      return res.status(200).json({ ok: true, accounts: accountResult.length, suppliers: supplierResult.length });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('dashboard API error:', error);
    return res.status(500).json({ error: 'Error al sincronizar el dashboard' });
  }
}
