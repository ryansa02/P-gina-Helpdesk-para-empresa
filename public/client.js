async function fetchMe() {
  const res = await fetch('/api/me');
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

async function fetchTickets() {
  const res = await fetch('/api/tickets');
  const data = await res.json();
  return data.tickets || [];
}

async function createTicket(payload) {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao criar chamado');
  return data;
}

async function closeTicket(id, description) {
  const res = await fetch(`/api/tickets/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao fechar chamado');
  return data;
}

window.CSC = { fetchMe, fetchTickets, createTicket, closeTicket };

