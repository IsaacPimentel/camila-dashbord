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
      const tasks = await prisma.quickTask.findMany({
        include: { account: true, campaign: true },
        orderBy: { dueDate: 'asc' },
      });
      return res.status(200).json(tasks);
    }

    if (req.method === 'POST') {
      const task = await prisma.quickTask.create({
        data: {
          accountId: String(body.accountId || '').trim(),
          text: String(body.text || '').trim(),
          dueDate: body.dueDate ? String(body.dueDate) : null,
          done: Boolean(body.done),
          campaignId: body.campaignId ? String(body.campaignId) : null,
        },
        include: { account: true, campaign: true },
      });
      return res.status(201).json(task);
    }

    if (req.method === 'PUT') {
      const { id, ...rest } = body;
      if (!id) return res.status(400).json({ error: 'Falta el ID de la tarea' });

      const task = await prisma.quickTask.update({
        where: { id: String(id) },
        data: {
          accountId: rest.accountId ? String(rest.accountId) : undefined,
          text: rest.text ? String(rest.text).trim() : undefined,
          dueDate: rest.dueDate !== undefined ? (rest.dueDate ? String(rest.dueDate) : null) : undefined,
          done: rest.done !== undefined ? Boolean(rest.done) : undefined,
          campaignId: rest.campaignId !== undefined ? (rest.campaignId ? String(rest.campaignId) : null) : undefined,
        },
        include: { account: true, campaign: true },
      });
      return res.status(200).json(task);
    }

    if (req.method === 'DELETE') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Falta el ID de la tarea' });

      await prisma.quickTask.delete({ where: { id: String(id) } });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('quick tasks API error:', error);
    return res.status(500).json({ error: 'Error al consultar pendientes rápidos' });
  }
}
