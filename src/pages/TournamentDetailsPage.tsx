// src/pages/TournamentDetailsPage.tsx
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import axiosInstance from '@/lib/axios';

// Datos stub para el torneo de ejemplo
const mockTournament = {
  id: 'lqc-split-primavera-2026',
  name: 'LQC Split Primavera 2026',
  status: 'abiertas',
  prize: '$15,000 MXN + Skins + Trofeo',
  startDate: '2026-03-15',
  format: 'Liga regular + Playoffs',
  description: 'Torneo oficial de la Liga Queretana de League of Legends.',
  standings: [
    { position: 1, team: 'Eclipse QRO', wins: 8, losses: 1, points: 24 },
    { position: 2, team: 'Dragones Querétaro', wins: 7, losses: 2, points: 21 },
    { position: 3, team: 'ATAK Academy', wins: 6, losses: 3, points: 18 },
    { position: 4, team: 'Corregidora Warriors', wins: 5, losses: 4, points: 15 },
    // ... más equipos
  ],
  bracket: 'Simulación de bracket (aquí irá componente real o embed cuando tengamos API)',
};

const TournamentDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<any[]>([]);
const [loadingRegs, setLoadingRegs] = useState(true);

useEffect(() => {
  const fetchRegistrations = async () => {
    try {
      const { data } = await axiosInstance.get(`/api/tournaments/${id}/registrations`);
      setRegistrations(data);
    } catch (err) {
      console.error('Error cargando inscritos', err);
    } finally {
      setLoadingRegs(false);
    }
  };
  if (tournament?.status === 'abiertas') {
    fetchRegistrations();
  } else {
    setLoadingRegs(false);
  }
}, [id, tournament?.status]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const { data } = await axiosInstance.get(`/api/tournaments/${id}`);
        setTournament(data);
      } catch (err) {
        console.error('Error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

if (loading) return <div className="text-center py-20 text-white">Cargando detalles...</div>;
  if (!tournament) return <div className="text-center py-20 text-white">Torneo no encontrado</div>;

  return (
    <div className="min-h-screen bg-black text-white px-4 py-12">
      <div className="container mx-auto max-w-6xl">
        {/* Botón volver */}
        <Button asChild variant="ghost" className="mb-8 text-red-400 hover:bg-red-900/30">
          <Link to="/tournaments" className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            Volver a Torneos
          </Link>
        </Button>

        <h1 className="text-4xl font-bold mb-8">{tournament.name}</h1>

        {/* Info general */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* ... cards de premios, inicio, formato iguales */}
        </div>

        {/* Tabla de posiciones – SOLO si existen standings */}
        {tournament.standings && tournament.standings.length > 0 ? (
          <Card className="mb-12 bg-gray-900/80 border-red-800/40">
            <CardHeader>
              <CardTitle className="text-2xl text-red-400">Tabla de Posiciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-red-800/40">
                    <tr>
                      <th className="pb-3">Pos</th>
                      <th className="pb-3">Equipo</th>
                      <th className="pb-3">Victorias</th>
                      <th className="pb-3">Derrotas</th>
                      <th className="pb-3">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournament.standings.map((team: any) => (
                      <tr key={team.position} className="border-b border-gray-800">
                        <td className="py-3">{team.position}°</td>
                        <td className="py-3 font-semibold">{team.team}</td>
                        <td className="py-3">{team.wins}</td>
                        <td className="py-3">{team.losses}</td>
                        <td className="py-3 text-red-400 font-bold">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-12 bg-gray-900/80 border-red-800/40">
            <CardHeader>
              <CardTitle className="text-2xl text-red-400">Fase Actual</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-12">
              <p className="text-xl text-gray-400">
                {tournament.status === 'abiertas'
                  ? 'Inscripciones abiertas. La tabla de posiciones estará disponible al iniciar la fase de liga.'
                  : 'Sin tabla de posiciones disponible en este momento.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Equipos inscritos – solo en abiertas */}
        {tournament.status === 'abiertas' && (
          <Card className="mt-12 bg-gray-900/80 border-red-800/40">
            <CardHeader>
              <CardTitle className="text-2xl text-red-400 flex items-center gap-3">
                <Users className="h-7 w-7" />
                Equipos Inscritos ({registrations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRegs ? (
                <p className="text-gray-500 text-center py-8">Cargando equipos...</p>
              ) : registrations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aún no hay equipos inscritos. ¡Sé el primero!</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-red-800/40">
                      <tr>
                        <th className="pb-3">Equipo</th>
                        <th className="pb-3">Capitán</th>
                        <th className="pb-3">Jugadores</th>
                        <th className="pb-3">Contacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((reg, i) => (
                        <tr key={i} className="border-b border-gray-800">
                          <td className="py-4 font-bold text-red-400">{reg.teamName}</td>
                          <td className="py-4">{reg.captainRiotId}</td>
                          <td className="py-4 text-sm">
                            {reg.players.map((p: any) => p.riotId || p.name || 'Sin Riot ID').join(', ')}
                          </td>
                          <td className="py-4 text-gray-400">{reg.contact || 'No proporcionado'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bracket placeholder */}
        <Card className="mt-12 bg-gray-900/80 border-red-800/40">
          <CardHeader>
            <CardTitle className="text-2xl text-red-400">Bracket / Playoffs</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-20 text-gray-500">
            <Trophy className="h-20 w-20 mx-auto mb-6 text-gray-700" />
            <p className="text-xl">Bracket disponible cuando inicien playoffs</p>
            <p className="mt-4">Con API de Riot: matches en vivo, stats por jugador y más.</p>
          </CardContent>
        </Card>
      </div>
    </div>

    
  );

  {tournament.riotCodes && tournament.riotCodes.length > 0 && (
  <Card className="mt-12 bg-gradient-to-br from-purple-900/50 to-red-900/50 border-purple-600">
    <CardHeader>
      <CardTitle className="text-2xl text-purple-300">
        Códigos Oficiales Riot (Cliente LoL)
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-300 mb-6">
        Los jugadores deben copiar uno de estos códigos e ingresarlo en:
        <br />
        <strong>Cliente de LoL → Play → Torneos → Buscar por código</strong>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tournament.riotCodes.map((code: string, i: number) => (
          <div
            key={i}
            className="bg-black/50 p-4 rounded-lg text-center font-bold text-xl text-purple-400 border border-purple-600 hover:border-purple-400 transition cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(code);
              alert('Código copiado: ' + code);
            }}
          >
            {code}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
};

export default TournamentDetailsPage;