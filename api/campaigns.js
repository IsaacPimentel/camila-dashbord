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
    const body = safeBody(req);

    if (req.method === 'GET') {
      const campaigns = await prisma.campaign.findMany({
        include: {
          account: true,
          checklist: true,
          sunatItems: true,
          pendings: { include: { supplier: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(campaigns);
    }

    if (req.method === 'POST') {
      const campaign = await prisma.campaign.create({
        data: {
          accountId: String(body.accountId || '').trim(),
          name: String(body.name || '').trim(),
          elemento: String(body.elemento || '').trim(),
          startDate: String(body.startDate || ''),
          endDate: body.endDate ? String(body.endDate) : null,
          stage: body.stage || 'no_implementado',
          cotizacionAprobada: Boolean(body.cotizacionAprobada),
          ordenCompra: Boolean(body.ordenCompra),
          facturado: Boolean(body.facturado),
        },
        include: {
          account: true,
          checklist: true,
          sunatItems: true,
          pendings: true,
        },
      });
      return res.status(201).json(campaign);
    }

    if (req.method === 'PUT') {
      const { id, ...rest } = body;
      if (!id) return res.status(400).json({ error: 'Falta el ID de la campaña' });

      const campaign = await prisma.campaign.update({
        where: { id: String(id) },
        data: {
          accountId: rest.accountId ? String(rest.accountId) : undefined,
          name: rest.name ? String(rest.name).trim() : undefined,
          elemento: rest.elemento ? String(rest.elemento).trim() : undefined,
          startDate: rest.startDate ? String(rest.startDate) : undefined,
          endDate: rest.endDate !== undefined ? (rest.endDate ? String(rest.endDate) : null) : undefined,
          stage: rest.stage ? String(rest.stage) : undefined,
          cotizacionAprobada: rest.cotizacionAprobada !== undefined ? Boolean(rest.cotizacionAprobada) : undefined,
          ordenCompra: rest.ordenCompra !== undefined ? Boolean(rest.ordenCompra) : undefined,
          facturado: rest.facturado !== undefined ? Boolean(rest.facturado) : undefined,
        },
        include: {
          account: true,
          checklist: true,
          sunatItems: true,
          pendings: true,
        },
      });
      return res.status(200).json(campaign);
    }

    if (req.method === 'DELETE') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Falta el ID de la campaña' });

      await prisma.campaign.delete({ where: { id: String(id) } });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('campaigns API error:', error);
    return res.status(500).json({ error: 'Error al consultar campañas' });
  }
}
