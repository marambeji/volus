import React from 'react';
import {
  type ReportRequestRow,
  type ReportBalanceRow,
  type ReportOverlaps,
} from '../../services/reportsApi';
import { type LeaveTypeItem } from '../../services/leaveTypesApi';

interface PdfReportDocumentProps {
  balances: ReportBalanceRow[];
  requests: ReportRequestRow[];
  overlaps: ReportOverlaps | null;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    leaveTypeId?: string;
    department?: string;
    country?: string;
    managerId?: string;
    status?: string;
  };
  leaveTypes: LeaveTypeItem[];
  generatorName: string;
  generatorRole: string;
}

export const PdfReportDocument: React.FC<PdfReportDocumentProps> = ({
  balances,
  requests,
  overlaps,
  filters,
  leaveTypes,
  generatorName,
  generatorRole,
}) => {
  const safeBalances = Array.isArray(balances) ? balances : [];
  const safeRequests = Array.isArray(requests) ? requests : [];

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // ── 1. KPI Calculations (Full Dataset) ────────────────────────────────────
  const totalEmployees = safeBalances.length;
  const totalRequests = safeRequests.length;

  const approvedRequests = safeRequests.filter((r) => r.status === 'APPROVED');
  const pendingRequests = safeRequests.filter((r) => r.status === 'PENDING');
  const rejectedRequests = safeRequests.filter((r) => r.status === 'REJECTED');
  const cancelledRequests = safeRequests.filter((r) => r.status === 'CANCELLED');

  const approvedCount = approvedRequests.length;
  const pendingCount = pendingRequests.length;
  const rejectedCount = rejectedRequests.length;
  const cancelledCount = cancelledRequests.length;

  const approvedDays = approvedRequests.reduce((sum, r) => sum + (Number(r.durationDays) || 0), 0);
  const pendingDays = pendingRequests.reduce((sum, r) => sum + (Number(r.durationDays) || 0), 0);
  const totalRequestedDays = safeRequests.reduce((sum, r) => sum + (Number(r.durationDays) || 0), 0);

  const avgApprovedDuration = approvedCount > 0 ? (approvedDays / approvedCount).toFixed(1) : '0';
  const approvalRate = totalRequests > 0 ? Math.round((approvedCount / totalRequests) * 100) : 0;
  const rejectionRate = totalRequests > 0 ? Math.round((rejectedCount / totalRequests) * 100) : 0;
  const cancellationRate = totalRequests > 0 ? Math.round((cancelledCount / totalRequests) * 100) : 0;
  const pendingRate = totalRequests > 0 ? Math.round((pendingCount / totalRequests) * 100) : 0;

  // Negative balance employees
  const negativeBalanceEmployees = safeBalances.filter(
    (b) => typeof b.totalAvailable === 'number' && b.totalAvailable < 0
  );

  // Overlap stats
  const totalClusters = overlaps?.clusters?.length || 0;
  const peakConcurrent = overlaps?.peakConcurrent || 0;
  const totalOverlapDays = overlaps?.totalOverlapDays || 0;

  // ── 2. Breakdown by Leave Type ────────────────────────────────────────────
  const leaveTypeStats = (() => {
    const map = new Map<
      string,
      {
        name: string;
        totalReq: number;
        approvedReq: number;
        requestedDays: number;
        approvedDays: number;
        employees: Set<string>;
      }
    >();

    safeRequests.forEach((r) => {
      const name = r.leaveTypeName || 'Autre congé';
      const cur = map.get(name) || {
        name,
        totalReq: 0,
        approvedReq: 0,
        requestedDays: 0,
        approvedDays: 0,
        employees: new Set<string>(),
      };
      cur.totalReq += 1;
      const days = Number(r.durationDays) || 0;
      cur.requestedDays += days;
      if (r.employeeId) cur.employees.add(r.employeeId);
      if (r.status === 'APPROVED') {
        cur.approvedReq += 1;
        cur.approvedDays += days;
      }
      map.set(name, cur);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        employeeCount: item.employees.size,
        percentage: approvedDays > 0 ? Math.round((item.approvedDays / approvedDays) * 100) : 0,
        avgDuration: item.approvedReq > 0 ? (item.approvedDays / item.approvedReq).toFixed(1) : '0',
      }))
      .sort((a, b) => b.approvedDays - a.approvedDays);
  })();

  const topLeaveType = leaveTypeStats[0] || null;

  // ── 3. Monthly Temporal Analysis ──────────────────────────────────────────
  const monthlyStats = (() => {
    const map = new Map<
      string,
      { month: string; monthSort: string; approvedDays: number; requestCount: number; pendingCount: number }
    >();

    safeRequests.forEach((r) => {
      if (!r.startDate) return;
      const d = new Date(r.startDate);
      if (isNaN(d.getTime())) return;
      const monthKey = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      const monthSort = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const cur = map.get(monthKey) || {
        month: monthKey,
        monthSort,
        approvedDays: 0,
        requestCount: 0,
        pendingCount: 0,
      };
      cur.requestCount += 1;
      const days = Number(r.durationDays) || 0;
      if (r.status === 'APPROVED') cur.approvedDays += days;
      if (r.status === 'PENDING') cur.pendingCount += 1;
      map.set(monthKey, cur);
    });

    return Array.from(map.values()).sort((a, b) => a.monthSort.localeCompare(b.monthSort));
  })();

  const peakMonthObj = [...monthlyStats].sort((a, b) => b.approvedDays - a.approvedDays)[0] || null;

  // ── 4. Department Analysis ────────────────────────────────────────────────
  const deptStats = (() => {
    const map = new Map<
      string,
      { department: string; employees: Set<string>; approvedDays: number; pendingCount: number; requestCount: number }
    >();

    safeBalances.forEach((b) => {
      const dept = b.department || 'Non assigné';
      const cur = map.get(dept) || {
        department: dept,
        employees: new Set<string>(),
        approvedDays: 0,
        pendingCount: 0,
        requestCount: 0,
      };
      if (b.employeeId) cur.employees.add(b.employeeId);
      map.set(dept, cur);
    });

    safeRequests.forEach((r) => {
      const dept = r.department || 'Non assigné';
      const cur = map.get(dept) || {
        department: dept,
        employees: new Set<string>(),
        approvedDays: 0,
        pendingCount: 0,
        requestCount: 0,
      };
      cur.requestCount += 1;
      if (r.status === 'APPROVED') cur.approvedDays += Number(r.durationDays) || 0;
      if (r.status === 'PENDING') cur.pendingCount += 1;
      map.set(dept, cur);
    });

    return Array.from(map.values()).map((d) => ({
      ...d,
      employeeCount: d.employees.size,
      avgDaysPerEmp: d.employees.size > 0 ? (d.approvedDays / d.employees.size).toFixed(1) : '0',
    }));
  })();

  // ── 5. Executive Written Summary Narrative ────────────────────────────────
  const executiveNarrative = (() => {
    const parts: string[] = [];

    parts.push(
      `Le présent rapport consolide l'analyse de la gestion des congés pour l'organisation NOVELUS couvrant un périmètre de ${totalEmployees} collaborateur(s) et un total de ${totalRequests} demande(s) enregistrée(s).`
    );

    if (totalRequests > 0) {
      parts.push(
        `Sur l'ensemble des sollicitations, ${approvedCount} demande(s) ont été officiellement approuvées (${approvalRate}%), totalisant ${approvedDays} jour(s) d'absence consommés. Le taux de rejet s'élève à ${rejectionRate}% (${rejectedCount} demande(s)) et ${cancelledCount} demande(s) ont été annulées (${cancellationRate}%).`
      );
    }

    if (pendingCount > 0) {
      parts.push(
        `À ce jour, ${pendingCount} demande(s) restent en attente de validation (${pendingRate}% du volume global), représentant un volume potentiel de ${pendingDays} jour(s) de congé non encore inscrits définitivement au planning opérationnel.`
      );
    } else {
      parts.push(`L'intégralité des demandes soumises a été traitée par le flux de validation RH/Management.`);
    }

    if (topLeaveType) {
      parts.push(
        `Le type de congé prédominant est "${topLeaveType.name}", représentant ${topLeaveType.percentage}% des jours d'absence approuvés (${topLeaveType.approvedDays} jours répartis sur ${topLeaveType.approvedReq} demande(s)).`
      );
    }

    if (peakMonthObj && peakMonthObj.approvedDays > 0) {
      parts.push(
        `La période d'absence maximale identifiée est le mois de ${peakMonthObj.month} avec ${peakMonthObj.approvedDays} jour(s) accordé(s). Cette concentration nécessite une planification anticipée pour maintenir la continuité de service.`
      );
    }

    if (negativeBalanceEmployees.length > 0) {
      const names = negativeBalanceEmployees.map((b) => `${b.employeeName} (${b.totalAvailable}j)`).join(', ');
      parts.push(
        `Points d'attention prioritaires : Un solde de congés négatif est constaté pour ${negativeBalanceEmployees.length} collaborateur(s) : ${names}. Un contrôle des écritures de régularisation et des autorisations d'anticipation est vivement recommandé.`
      );
    } else if (totalEmployees > 0) {
      parts.push(`L'analyse des soldes montre une conformité globale des droits disponibles sans découvert critique constaté.`);
    }

    if (totalClusters > 0) {
      parts.push(
        `De plus, ${totalClusters} période(s) de chevauchement d'absences simultanées au sein de l'équipe ont été identifiées, avec un pic maximal de ${peakConcurrent} collaborateur(s) absents le même jour.`
      );
    }

    return parts.join(' ');
  })();

  return (
    <div className="pdf-report-document bg-white text-slate-900 font-sans text-xs leading-relaxed p-6 print:p-0 w-full max-w-5xl mx-auto">
      {/* ── HEADER CORPORATE (OFFICIAL NOVELUS LOGO & METADATA) ──────────────── */}
      <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900 mb-6">
        <div className="flex flex-col gap-1">
          {/* Logo Vectoriel NOVELUS */}
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-auto">
              <text
                x="0"
                y="30"
                fill="#0f172a"
                fontSize="28"
                fontWeight="900"
                letterSpacing="1"
                style={{ fontFamily: "'Arial Black',Arial,sans-serif", fontWeight: 900 }}
              >
                N
              </text>
              <circle cx="36" cy="20" r="7.5" fill="#96C13C" />
              <text
                x="50"
                y="30"
                fill="#0f172a"
                fontSize="28"
                fontWeight="900"
                letterSpacing="1"
                style={{ fontFamily: "'Arial Black',Arial,sans-serif", fontWeight: 900 }}
              >
                VELUS
              </text>
            </svg>
          </div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Système d'Information & Gestion des Ressources Humaines
          </p>
        </div>

        <div className="text-right text-[11px] text-slate-700 space-y-0.5">
          <p className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
            Rapport Officiel de Gestion des Congés
          </p>
          <p>
            <strong className="text-slate-900">Généré le :</strong> {dateFormatted} à {timeFormatted}
          </p>
          <p>
            <strong className="text-slate-900">Émetteur :</strong> {generatorName} ({generatorRole})
          </p>
          <p>
            <span className="inline-block bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300">
              DOCUMENT INTERNE ET CONFIDENTIEL
            </span>
          </p>
        </div>
      </div>

      {/* ── CADRE DES FILTRES & PÉRIMÈTRE D'EXTRACTION ──────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6">
        <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>📌</span> Périmètre & Filtres d'Extraction Appliqués
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-600">
          <div>
            <span className="text-slate-400 font-medium">Période du rapport :</span>{' '}
            <strong className="text-slate-800">{filters.dateFrom || 'Début d\'année'}</strong> au{' '}
            <strong className="text-slate-800">{filters.dateTo || 'Fin d\'année'}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Département :</span>{' '}
            <strong className="text-slate-800">{filters.department || 'Tous les départements'}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Pays / Entité :</span>{' '}
            <strong className="text-slate-800">{filters.country || 'Tous les pays'}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Type de congé :</span>{' '}
            <strong className="text-slate-800">
              {filters.leaveTypeId
                ? leaveTypes.find((t) => t.id === filters.leaveTypeId)?.label || filters.leaveTypeId
                : 'Tous les types'}
            </strong>
          </div>
        </div>
      </div>

      {/* ── SECTION C : SYNTHÈSE EXÉCUTIVE ET RATIONNEL MANAGÉRIAL ──────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">1.</span> Synthèse Exécutive et Analyse Managériale
        </h2>
        <div className="bg-violet-50/70 border border-violet-200 rounded-lg p-4 text-slate-800 text-xs leading-relaxed space-y-2">
          <p className="font-medium">{executiveNarrative}</p>
          <div className="pt-2 border-t border-violet-200/60 text-[11px] text-violet-900 italic font-medium">
            💡 <strong>Note d'orientation RH :</strong> "Les préconisations figurant dans cette synthèse visent à
            sécuriser les plannings opérationnels, garantir l'équité de traitement des droits et assurer la conformité
            réglementaire des soldes."
          </div>
        </div>
      </div>

      {/* ── SECTION D : PÉRIMÈTRE ET MÉTHODOLOGIE DE CALCUL ──────────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">2.</span> Périmètre d'Analyse et Règles Méthodologiques
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <h4 className="font-bold text-slate-800 mb-1">Règles de Calcul & Statuts</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>Consommation effective :</strong> Seules les demandes validées à l'état{' '}
                <span className="text-emerald-700 font-bold">APPROVED</span> sont comptabilisées dans le volume des jours
                consommés.
              </li>
              <li>
                <strong>Exclusions de consommation :</strong> Les demandes rejetées (
                <span className="text-rose-700 font-bold">REJECTED</span>) et annulées (
                <span className="text-slate-500 font-bold">CANCELLED</span>) sont rigoureusement exclues du décompte des
                jours pris.
              </li>
              <li>
                <strong>Jours ouvrés et Fériés :</strong> La durée d'absence calculée déduit automatiquement les week-ends
                et les jours fériés légaux de l'entité pays.
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <h4 className="font-bold text-slate-800 mb-1">Traçabilité & Qualité des Données</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>Source d'extraction :</strong> Base de données centrale PostgreSQL via l'API NestJS du portail
                RH NOVELUS.
              </li>
              <li>
                <strong>Exhaustivité du périmètre :</strong> Les totaux sont calculés sur la totalité des enregistrements
                filtrés (et non uniquement sur la page affichée).
              </li>
              <li>
                <strong>Conformité des écritures :</strong> Solde disponible = Droits annuels + Acquis + Ajustements –
                Jours approuvés.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── SECTION E : TABLEAU DÉTAILLÉ DES INDICATEURS CLÉS (KPI) ─────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">3.</span> Indicateurs Clés de Performance (KPI) et Diagnostic
        </h2>
        <table className="w-full border-collapse text-left border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
              <th className="p-2 border-r border-slate-200">Indicateur RH</th>
              <th className="p-2 border-r border-slate-200 text-center">Valeur</th>
              <th className="p-2 border-r border-slate-200">Définition & Méthode</th>
              <th className="p-2 border-r border-slate-200 text-center">Niveau de Risque</th>
              <th className="p-2">Action Recommandée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            <tr>
              <td className="p-2 font-bold border-r border-slate-200">Effectif total analysé</td>
              <td className="p-2 text-center font-extrabold border-r border-slate-200">{totalEmployees}</td>
              <td className="p-2 border-r border-slate-200 text-slate-600">Collaborateurs actifs sous supervision</td>
              <td className="p-2 text-center border-r border-slate-200">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  NORMAL
                </span>
              </td>
              <td className="p-2 text-slate-600">Suivi du périmètre nominal</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-200">Volume des demandes</td>
              <td className="p-2 text-center font-extrabold border-r border-slate-200">{totalRequests}</td>
              <td className="p-2 border-r border-slate-200 text-slate-600">Demandes déposées sur la période</td>
              <td className="p-2 text-center border-r border-slate-200">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  NORMAL
                </span>
              </td>
              <td className="p-2 text-slate-600">Revue d'activité régulière</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-200">Taux d'approbation</td>
              <td className="p-2 text-center font-extrabold border-r border-slate-200 text-emerald-700">
                {approvalRate}% ({approvedCount})
              </td>
              <td className="p-2 border-r border-slate-200 text-slate-600">
                Demandes validées / Total des demandes
              </td>
              <td className="p-2 text-center border-r border-slate-200">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  NORMAL
                </span>
              </td>
              <td className="p-2 text-slate-600">Planification validée</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-200">Demandes en attente (Pending)</td>
              <td className="p-2 text-center font-extrabold border-r border-slate-200 text-amber-700">
                {pendingCount} ({pendingRate}%)
              </td>
              <td className="p-2 border-r border-slate-200 text-slate-600">
                Absences soumises sans décision finale
              </td>
              <td className="p-2 text-center border-r border-slate-200">
                {pendingCount > 0 ? (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    À SURVEILLER
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    NORMAL
                  </span>
                )}
              </td>
              <td className="p-2 text-slate-600">
                {pendingCount > 0 ? 'Valider les demandes avant échéance' : 'Aucune action requise'}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-200">Soldes négatifs constatés</td>
              <td className="p-2 text-center font-extrabold border-r border-slate-200 text-rose-700">
                {negativeBalanceEmployees.length}
              </td>
              <td className="p-2 border-r border-slate-200 text-slate-600">Collaborateurs avec solde disponible &lt; 0</td>
              <td className="p-2 text-center border-r border-slate-200">
                {negativeBalanceEmployees.length > 0 ? (
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    CRITIQUE
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    NORMAL
                  </span>
                )}
              </td>
              <td className="p-2 text-slate-600">
                {negativeBalanceEmployees.length > 0
                  ? 'Vérifier l\'historique des droits et régulariser'
                  : 'Soldes conformes'}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-200">Chevauchements d'absences</td>
              <td className="p-2 text-center font-extrabold border-r border-slate-200 text-violet-700">
                {totalClusters} grappe(s)
              </td>
              <td className="p-2 border-r border-slate-200 text-slate-600">Absences approuvées simultanées</td>
              <td className="p-2 text-center border-r border-slate-200">
                {totalClusters > 0 ? (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    À SURVEILLER
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    NORMAL
                  </span>
                )}
              </td>
              <td className="p-2 text-slate-600">Vérifier la couverture d'équipe durant le pic</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── SECTION F : REPARTITION ET ANALYSE PAR TYPE DE CONGÉ ────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">4.</span> Analyse par Type de Congé
        </h2>
        <table className="w-full border-collapse text-left border border-slate-200 mb-3">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
              <th className="p-2 border-r border-slate-200">Type de Congé</th>
              <th className="p-2 border-r border-slate-200 text-center">Demandes Deposees</th>
              <th className="p-2 border-r border-slate-200 text-center">Demandes Approuvees</th>
              <th className="p-2 border-r border-slate-200 text-center">Jours Approuves</th>
              <th className="p-2 border-r border-slate-200 text-center">% du Total Jours</th>
              <th className="p-2 border-r border-slate-200 text-center">Duree Moyenne</th>
              <th className="p-2 text-center">Collaborateurs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {leaveTypeStats.length > 0 ? (
              leaveTypeStats.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                  <td className="p-2 font-bold border-r border-slate-200 text-slate-900">{item.name}</td>
                  <td className="p-2 text-center border-r border-slate-200">{item.totalReq}</td>
                  <td className="p-2 text-center font-bold border-r border-slate-200 text-emerald-700">
                    {item.approvedReq}
                  </td>
                  <td className="p-2 text-center font-extrabold border-r border-slate-200 text-slate-900">
                    {item.approvedDays}j
                  </td>
                  <td className="p-2 text-center border-r border-slate-200 font-bold">{item.percentage}%</td>
                  <td className="p-2 text-center border-r border-slate-200">{item.avgDuration}j</td>
                  <td className="p-2 text-center font-semibold">{item.employeeCount}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                  Aucune donnée disponible pour les types de congés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {topLeaveType && (
          <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
            📝 <strong>Analyse RH par motif :</strong> Le congé de type <strong>"{topLeaveType.name}"</strong> est la
            principale cause d'absence avec <strong>{topLeaveType.percentage}%</strong> du volume global accordé (
            {topLeaveType.approvedDays} jours). Sa durée moyenne constatée est de {topLeaveType.avgDuration} jour(s) par
            demande.
          </p>
        )}
      </div>

      {/* ── SECTION G : REPARTITION PAR STATUT DE DEMANDE ────────────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">5.</span> Distribution et Traitement des Statuts de Validation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-emerald-800 uppercase">Approuvées (APPROVED)</p>
            <p className="text-xl font-black text-emerald-700">{approvedCount}</p>
            <p className="text-[10px] text-emerald-600 font-medium">{approvedDays} jours au total</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-amber-800 uppercase">En Attente (PENDING)</p>
            <p className="text-xl font-black text-amber-700">{pendingCount}</p>
            <p className="text-[10px] text-amber-600 font-medium">{pendingDays} jours réservés</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-rose-800 uppercase">Rejetées (REJECTED)</p>
            <p className="text-xl font-black text-rose-700">{rejectedCount}</p>
            <p className="text-[10px] text-rose-600 font-medium">Taux de refus : {rejectionRate}%</p>
          </div>
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-700 uppercase">Annulées (CANCELLED)</p>
            <p className="text-xl font-black text-slate-600">{cancelledCount}</p>
            <p className="text-[10px] text-slate-500 font-medium">Droits réintégrés au solde</p>
          </div>
        </div>
      </div>

      {/* ── SECTION H : ANALYSE CHRONOLOGIQUE ET MENSUELLE ──────────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">6.</span> Évolution Mensuelle & Profil Temporel d'Absence
        </h2>
        <table className="w-full border-collapse text-left border border-slate-200 mb-3">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
              <th className="p-2 border-r border-slate-200">Mois d'Absence</th>
              <th className="p-2 border-r border-slate-200 text-center">Demandes Totales</th>
              <th className="p-2 border-r border-slate-200 text-center">Jours Approuves</th>
              <th className="p-2 border-r border-slate-200 text-center">Demandes en Attente</th>
              <th className="p-2 text-left">Diagnostic Temporel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {monthlyStats.length > 0 ? (
              monthlyStats.map((m, idx) => {
                const isPeak = peakMonthObj && m.month === peakMonthObj.month;
                return (
                  <tr key={idx} className={isPeak ? 'bg-amber-50/60 font-medium' : idx % 2 === 1 ? 'bg-slate-50' : ''}>
                    <td className="p-2 font-bold border-r border-slate-200 capitalize">
                      {m.month} {isPeak && <span className="text-amber-700 font-bold text-[10px]">(PIC)</span>}
                    </td>
                    <td className="p-2 text-center border-r border-slate-200">{m.requestCount}</td>
                    <td className="p-2 text-center font-extrabold border-r border-slate-200 text-slate-900">
                      {m.approvedDays}j
                    </td>
                    <td className="p-2 text-center border-r border-slate-200 font-bold text-amber-700">
                      {m.pendingCount}
                    </td>
                    <td className="p-2 text-slate-600">
                      {isPeak
                        ? 'Forte concentration d\'absences. Vigilance sur la continuité opérationnelle.'
                        : 'Charge d\'absence modérée.'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                  Aucune distribution mensuelle enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── SECTION I & J : ANALYSE DES SOLDES & RECTIFICATIONS ────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">7.</span> Synthèse des Soldes de Congés par Collaborateur
        </h2>
        <table className="w-full border-collapse text-left border border-slate-200 mb-3">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
              <th className="p-2 border-r border-slate-200">Collaborateur</th>
              <th className="p-2 border-r border-slate-200">Département</th>
              <th className="p-2 border-r border-slate-200">Pays</th>
              <th className="p-2 border-r border-slate-200 text-center">Solde Congé Annuel</th>
              <th className="p-2 border-r border-slate-200 text-center">Solde Total Disponible</th>
              <th className="p-2 text-center">Statut Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {safeBalances.length > 0 ? (
              safeBalances.map((b, idx) => {
                const annual = b.balances?.annual || b.balances?.Annual || null;
                const isNeg = typeof b.totalAvailable === 'number' && b.totalAvailable < 0;
                return (
                  <tr key={idx} className={isNeg ? 'bg-rose-50/50' : idx % 2 === 1 ? 'bg-slate-50' : ''}>
                    <td className="p-2 font-bold border-r border-slate-200 text-slate-900">{b.employeeName}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-600">{b.department || 'N/A'}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-600">{b.country || 'N/A'}</td>
                    <td className="p-2 text-center border-r border-slate-200 font-medium">
                      {annual ? `${annual.available}j (pris: ${annual.used}j)` : 'N/A'}
                    </td>
                    <td
                      className={`p-2 text-center font-extrabold border-r border-slate-200 ${
                        isNeg ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {b.totalAvailable}j
                    </td>
                    <td className="p-2 text-center">
                      {isNeg ? (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          DÉCOUVERT
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          CONFORME
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                  Aucun solde répertorié pour ce périmètre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── SECTION K : MATRICE DES CHEVAUCHEMENTS & RISQUES ────────────────── */}
      {totalClusters > 0 && (
        <div className="mb-6 break-inside-avoid">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
            <span className="text-violet-700">8.</span> Registre des Chevauchements d'Absences Simultanées
          </h2>
          <div className="space-y-2">
            {overlaps?.clusters.map((cluster, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded p-3 text-[11px]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-extrabold text-slate-900">
                    Période du {cluster.startDate} au {cluster.endDate}
                  </span>
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded">
                    {cluster.requests.length} collaborateurs absents en même temps
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-700">
                  {cluster.requests.map((r, rIdx) => (
                    <div key={rIdx} className="bg-white p-1.5 rounded border border-slate-200 font-medium">
                      👤 {r.employeeName} ({r.leaveTypeName})<br />
                      <span className="text-[10px] text-slate-400">
                        {r.startDate} ➔ {r.endDate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION O : PLAN D'ACTION RH PRIORISÉ ──────────────────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">9.</span> Plan d'Action Priorisé et Directives RH
        </h2>
        <table className="w-full border-collapse text-left border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
              <th className="p-2 border-r border-slate-200 text-center">Priorité</th>
              <th className="p-2 border-r border-slate-200">Constat & Preuve</th>
              <th className="p-2 border-r border-slate-200">Impact RH / Opérationnel</th>
              <th className="p-2 border-r border-slate-200">Action Recommandée</th>
              <th className="p-2 text-center">Responsable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {negativeBalanceEmployees.length > 0 && (
              <tr>
                <td className="p-2 text-center border-r border-slate-200">
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    CRITIQUE
                  </span>
                </td>
                <td className="p-2 border-r border-slate-200 font-medium">
                  {negativeBalanceEmployees.length} collaborateur(s) en découvert de congé.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-600">
                  Risque de non-conformité légale et erreur d'acquisition.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-600">
                  Audit du grand livre des soldes et régularisation RH.
                </td>
                <td className="p-2 text-center font-bold">Équipe RH central</td>
              </tr>
            )}
            {pendingCount > 0 && (
              <tr>
                <td className="p-2 text-center border-r border-slate-200">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    ÉLEVÉE
                  </span>
                </td>
                <td className="p-2 border-r border-slate-200 font-medium">
                  {pendingCount} demande(s) en attente de décision.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-600">
                  Incertitude sur le planning d'équipe et mécontentement.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-600">
                  Relancer les managers valideurs pour clôture sous 48h.
                </td>
                <td className="p-2 text-center font-bold">Manager N+1</td>
              </tr>
            )}
            {totalClusters > 0 && (
              <tr>
                <td className="p-2 text-center border-r border-slate-200">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    MOYENNE
                  </span>
                </td>
                <td className="p-2 border-r border-slate-200 font-medium">
                  {totalClusters} période(s) de chevauchement d'absence.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-600">
                  Risque de sous-effectif ponctuel sur les compétences clés.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-600">
                  Coordonner les relais d'activité et la continuité de service.
                </td>
                <td className="p-2 text-center font-bold">Chef de Projet / N+1</td>
              </tr>
            )}
            <tr className={negativeBalanceEmployees.length === 0 && pendingCount === 0 && totalClusters === 0 ? '' : 'bg-slate-50'}>
              <td className="p-2 text-center border-r border-slate-200">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  BASSE
                </span>
              </td>
              <td className="p-2 border-r border-slate-200 font-medium">Suivi périodique des droits à congé.</td>
              <td className="p-2 border-r border-slate-200 text-slate-600">Maintien de la qualité des données RH.</td>
              <td className="p-2 border-r border-slate-200 text-slate-600">Revue trimestrielle des tableaux de bord.</td>
              <td className="p-2 text-center font-bold">Admin RH</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── SECTION N : REGISTRE DÉTAILLÉ DES DEMANDES DE CONGÉ ─────────────── */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-2">
          <span className="text-violet-700">10.</span> Registre Détaillé des Demandes de Congé (Extrait Filtré)
        </h2>
        <table className="w-full border-collapse text-left border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
              <th className="p-1.5 border-r border-slate-200">Collaborateur</th>
              <th className="p-1.5 border-r border-slate-200">Département</th>
              <th className="p-1.5 border-r border-slate-200">Type de Congé</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Début</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Fin</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Durée</th>
              <th className="p-1.5 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[10px]">
            {safeRequests.length > 0 ? (
              safeRequests.slice(0, 30).map((r, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                  <td className="p-1.5 font-bold border-r border-slate-200">{r.employeeName}</td>
                  <td className="p-1.5 border-r border-slate-200 text-slate-600">{r.department || 'N/A'}</td>
                  <td className="p-1.5 border-r border-slate-200 text-slate-700">{r.leaveTypeName}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono">{r.startDate?.slice(0, 10)}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono">{r.endDate?.slice(0, 10)}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-bold">{r.durationDays}j</td>
                  <td className="p-1.5 text-center font-bold">
                    {r.status === 'APPROVED' && <span className="text-emerald-700">APPROVED</span>}
                    {r.status === 'PENDING' && <span className="text-amber-700">PENDING</span>}
                    {r.status === 'REJECTED' && <span className="text-rose-700">REJECTED</span>}
                    {r.status === 'CANCELLED' && <span className="text-slate-500">CANCELLED</span>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                  Aucune demande répertoriée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {safeRequests.length > 30 && (
          <p className="text-[10px] text-slate-400 italic mt-1 text-right">
            * Registre limité aux 30 premières demandes pour la synthèse imprimable. L'export CSV contient l'exhaustivité des {safeRequests.length} lignes.
          </p>
        )}
      </div>

      {/* ── FOOTER CORPORATE (OFFICIAL CONFIDENTIALITY & SIGNATURE) ─────────── */}
      <div className="pt-6 mt-8 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-600 break-inside-avoid">
        <div>
          <p className="font-extrabold text-slate-900">NOVELUS Human Resources & Executive Management System</p>
          <p className="text-slate-500">Document généré automatiquement à des fins de pilotage RH et de conformité.</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Confidentiel — Reproduction et diffusion strictly réservées aux personnes habilitées.</p>
        </div>
        <div className="text-right border-t border-slate-400 pt-2 min-w-56">
          <p className="font-bold text-slate-900">Visa & Signature du Responsable RH / Manager</p>
          <p className="text-[9px] text-slate-400 mt-4">Date et Signataire : ___________________________</p>
        </div>
      </div>
    </div>
  );
};
