import { prisma } from '../lib/prisma.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const accounts = await prisma.account.findMany({
        orderBy: { name: 'asc' },
      });
      return res.status(200).json(accounts);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const account = await prisma.account.create({
        data: {
          name: String(body.name || '').trim(),
        },
      });
      return res.status(201).json(account);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('accounts API error:', error);
    return res.status(500).json({ error: 'Error al consultar cuentas' });
  }
}
