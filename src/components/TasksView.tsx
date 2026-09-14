import React, { useState } from 'react';
import { DistributionTask, TaskPriority, TaskStatus, TaskType, UserRole } from '../types';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Plus,
  Filter,
  CheckCircle2,
  PlayCircle,
  UserCheck,
  Package,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface TasksViewProps {
  tasks: DistributionTask[];
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onCreateTask: (taskData: Partial<DistributionTask>) => Promise<void>;
  currentRole: UserRole;
  currentUserName: string;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onUpdateTaskStatus,
  onCreateTask,
  currentRole,
  currentUserName,
}) => {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<TaskType>('order_fulfillment');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAssignedRole, setNewAssignedRole] = useState<UserRole>('Warehouse');
  const [newCustomer, setNewCustomer] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTasks = safeTasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (roleFilter !== 'all' && task.assigned_to_role !== roleFilter) return false;
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateTask({
        title: newTitle.trim(),
        description: newDesc.trim(),
        task_type: newType,
        priority: newPriority,
        assigned_to_role: newAssignedRole,
        related_customer_name: newCustomer.trim() || undefined,
        related_product_name: newProduct.trim() || undefined,
        created_by_name: currentUserName,
      });
      setIsNewTaskModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewCustomer('');
      setNewProduct('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityColors: Record<TaskPriority, { badge: string; text: string; bg: string }> = {
    urgent: { badge: 'bg-rose-100 text-rose-800 border-rose-200', text: 'text-rose-600', bg: 'border-l-rose-500' },
    high: { badge: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-600', bg: 'border-l-amber-500' },
    medium: { badge: 'bg-blue-100 text-blue-800 border-blue-200', text: 'text-blue-600', bg: 'border-l-blue-500' },
    low: { badge: 'bg-stone-100 text-stone-700 border-stone-200', text: 'text-stone-500', bg: 'border-l-stone-400' },
  };

  const statusLabels: Record<TaskStatus, { label: string; badge: string }> = {
    todo: { label: 'À faire', badge: 'bg-stone-100 text-stone-700 border-stone-200' },
    in_progress: { label: 'En cours', badge: 'bg-amber-100 text-amber-900 border-amber-200' },
    completed: { label: 'Terminée', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    cancelled: { label: 'Annulée', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  };

  const taskTypeLabels: Record<TaskType, string> = {
    order_fulfillment: 'Préparation Commande',
    stock_replenishment: 'Réassort & Rayonnage',
    dispatch_delivery: 'Livraison & Expédition',
    inventory_audit: 'Inventaire Physique',
    supplier_return: 'Retour Fournisseur',
    cash_reconciliation: 'Clôture & Caisse',
  };

  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Overview & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-cinzel">
            Tâches &amp; Dispatch Distribution
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Coordination en temps réel entre Dépôt, Caisse, Livraisons et Direction. Synchronisé sur tous les terminaux.
          </p>
        </div>

        <button
          onClick={() => setIsNewTaskModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Tâche</span>
        </button>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Total Tâches</div>
          <div className="text-2xl font-bold text-stone-900 mt-1">{tasks.length}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">À faire</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{todoCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">En cours</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{inProgressCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Terminées</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
          <span className="text-xs text-stone-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Statut:
          </span>
          {(['all', 'todo', 'in_progress', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {st === 'all'
                ? 'Tous'
                : st === 'todo'
                ? `À faire (${todoCount})`
                : st === 'in_progress'
                ? `En cours (${inProgressCount})`
                : 'Terminées'}
            </button>
          ))}
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-400">Rôle affecté:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="border border-stone-200 rounded-lg px-2.5 py-1 text-xs text-stone-700 bg-stone-50 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">Tous les rôles</option>
            <option value="Warehouse">Dépôt (Warehouse)</option>
            <option value="Cashier">Caisse (Cashier)</option>
            <option value="Manager">Manager</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <CheckSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-stone-800">Aucune tâche trouvée</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Aucune tâche ne correspond aux filtres sélectionnés. Créez-en une nouvelle pour synchroniser votre équipe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const pStyle = priorityColors[task.priority];
            const sStyle = statusLabels[task.status];
            const isCompleted = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border border-stone-200 border-l-4 ${pStyle.bg} p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow`}
              >
                <div>
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {taskTypeLabels[task.task_type] || task.task_type}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${pStyle.badge}`}>
                        {task.priority.toUpperCase()}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${sStyle.badge}`}>
                        {sStyle.label}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className={`text-sm font-bold text-stone-900 leading-snug ${isCompleted ? 'line-through text-stone-400' : ''}`}>
                    {task.title}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 line-clamp-3">
                    {task.description}
                  </p>

                  {/* Metadata Chips */}
                  <div className="mt-3 space-y-1.5 text-[11px] text-stone-500">
                    {task.related_invoice_number && (
                      <div className="flex items-center gap-1 text-amber-900 bg-amber-50/60 px-2 py-0.5 rounded border border-amber-200/50">
                        <Package className="w-3 h-3 text-amber-700 shrink-0" />
                        <span className="font-semibold">Facture:</span>
                        <span className="font-mono">{task.related_invoice_number}</span>
                      </div>
                    )}
                    {task.related_customer_name && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-stone-400 shrink-0" />
                        <span>Client:</span>
                        <span className="font-medium text-stone-700">{task.related_customer_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100">
                      <span>Rôle: <strong className="text-stone-700">{task.assigned_to_role}</strong></span>
                      <span>Créé par: {task.created_by_name}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Controls */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(task.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {task.status === 'todo' && (
                      <button
                        onClick={() => onUpdateTaskStatus(task.id, 'in_progress')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer transition"
                      >
                        <PlayCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Démarrer</span>
                      </button>
                    )}

                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => onUpdateTaskStatus(task.id, 'completed')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Terminer</span>
                      </button>
                    )}

                    {task.status === 'completed' && (
                      <button
                        onClick={() => onUpdateTaskStatus(task.id, 'todo')}
                        className="text-[11px] text-stone-400 hover:text-stone-600 underline cursor-pointer"
                      >
                        Rouvrir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900 font-cinzel">Créer une Tâche de Distribution</h3>
                <p className="text-xs text-stone-500">Diffusée instantanément sur tous les postes connectés.</p>
              </div>
              <button
                onClick={() => setIsNewTaskModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Titre de la tâche *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Préparer 5 cartons Vatika Shampoo pour Pharmacie Centrale"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Détails, consignes d'emballage ou numéro de lot..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Type d'opération</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="order_fulfillment">Préparation Commande</option>
                    <option value="stock_replenishment">Réapprovisionnement</option>
                    <option value="dispatch_delivery">Livraison / Expédition</option>
                    <option value="inventory_audit">Audit / Inventaire</option>
                    <option value="cash_reconciliation">Clôture Caisse</option>
                    <option value="supplier_return">Retour Fournisseur</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Priorité</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="low">Basse (Low)</option>
                    <option value="medium">Moyenne (Medium)</option>
                    <option value="high">Haute (High)</option>
                    <option value="urgent">Urgente (Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Rôle assigné</label>
                  <select
                    value={newAssignedRole}
                    onChange={(e) => setNewAssignedRole(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="Warehouse">Dépôt / Magasinier</option>
                    <option value="Cashier">Caisse</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Client associé (optionnel)</label>
                  <input
                    type="text"
                    placeholder="Nom du client"
                    value={newCustomer}
                    onChange={(e) => setNewCustomer(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Produit concerné (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Vatika Shampoo Black Seed 180ml"
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer & Diffuser en Direct'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
