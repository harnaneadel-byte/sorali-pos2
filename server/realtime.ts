import { Server } from 'socket.io';
import { supabase } from './supabase_service.js';

export function initializeRealtime(io: Server) {
  console.log('Starting real-time connection to database...');

  // Listen for new or updated tasks
  supabase
    .channel('tasks-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'distribution_tasks' },
      (payload) => {
        const companyId = payload.new?.company_id || payload.old?.company_id;
        if (companyId) {
          io.to(companyId).emit('task_update', payload);
        }
      }
    )
    .subscribe();

  // Listen for stock updates
  supabase
    .channel('stock-channel')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'stock' },
      (payload) => {
        const companyId = payload.new?.company_id;
        if (companyId) {
          io.to(companyId).emit('stock_update', {
            product_id: payload.new.product_id,
            quantity_units: payload.new.quantity_units
          });
        }
      }
    )
    .subscribe();

  // Handle frontend computers connecting to this server
  io.on('connection', (socket) => {
    socket.on('join_company', (companyId: string) => {
      socket.join(companyId);
    });
  });
}