// src/pages/TournamentsPage.tsx
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Calendar, Users, Plus, Eye, ExternalLink, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosInstance from '@/lib/axios';
import { TournamentRegisterModal } from '@/components/TournamentRegisterModal';

interface Tournament {
  id: string;
  name: string;
  status: 'abiertas' | 'progreso' | 'finalizado';
  participants: number;
  maxParticipants: number;
  prize: string;
  startDate: string;
  format: string;
  description: string;
}

const TournamentsPage = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<'todos' | 'abiertas' | 'progreso' | 'finalizado'>('todos');


  const [registerOpen, setRegisterOpen] = useState(false);
const [selectedTournament, setSelectedTournament] = useState<{ id: string; name: string } | null>(null);

  const filteredTournaments = useMemo(() => {
    if (filter === 'todos') return tournaments;
    return tournaments.filter(t => t.status === filter);
  }, [tournaments, filter]);

  const getStatusBadge = (status: Tournament['status']) => {
    switch (status) {
      case 'abiertas': return 'bg-green-600 text-white';
      case 'progreso': return 'bg-yellow-600 text-white';
      case 'finalizado': return 'bg-gray-600 text-white';
    }
  };

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const { data } = await axiosInstance.get('/api/tournaments');
        setTournaments(data);
      } catch (err) {
        console.error('Error cargando torneos', err);
        // Fallback a stubs locales si API falla (buena práctica)
        setTournaments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  if (loading) return <div className="text-center py-20">Cargando torneos...</div>;

  return (
    <div className="min-h-screen bg-black text-white px-4 py-12">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-5 bg-gradient-to-r from-red-600 to-red-800 rounded-full shadow-2xl shadow-red-900/50">
              <Trophy className="h-14 w-14 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">Torneos ATAK.GG & LQC</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            La escena competitiva de Querétaro. Torneos oficiales, premios reales y stats integradas.
          </p>

<div className="mt-8 text-center">
  <Button
    onClick={async () => {
      const name = prompt('Nombre del torneo oficial Riot:');
      if (!name) return;

      try {
        const { data } = await axiosInstance.post('/api/tournaments/create-riot', { name });
        alert(`¡Torneo creado!\nID: ${data.riotTournamentId}\nCódigos generados: ${data.codes.length}\nGuarda los códigos y compártelos.`);
        console.log('Códigos:', data.codes);
        // Opcional: recarga torneos o redirige
      } catch (err: any) {
        alert('Error: ' + (err.response?.data?.error || err.message));
      }
    }}
    className="bg-purple-600 hover:bg-purple-700"
  >
    <Trophy className="h-5 w-5 mr-2" />
    Crear Torneo Oficial Riot (Dev)
  </Button>
  <p className="text-sm text-gray-500 mt-2">
    Solo para desarrollo. Genera códigos reales para el cliente de LoL.
  </p>
</div>


        </div>

        {/* Filtros */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-10">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 bg-gray-900">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="abiertas">Abiertas</TabsTrigger>
            <TabsTrigger value="progreso">En Progreso</TabsTrigger>
            <TabsTrigger value="finalizado">Finalizados</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lista */}
        <div className="grid gap-8">
          {filteredTournaments.map((t) => (
            <Card key={t.id} className="bg-gray-900/80 border-red-800/40 shadow-xl hover:shadow-red-900/50 transition">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl text-white">{t.name}</CardTitle>
                    <CardDescription className="text-gray-400 mt-2">{t.description}</CardDescription>
                  </div>
                  <Badge className={getStatusBadge(t.status)}>
                    {t.status === 'abiertas' ? 'Inscripciones abiertas' : t.status === 'progreso' ? 'En progreso' : 'Finalizado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-red-500" />
                    <span>{t.participants}/{t.maxParticipants} equipos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-red-500" />
                    <span>{t.prize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-red-500" />
                    <span>{new Date(t.startDate).toLocaleDateString('es-MX')}</span>
                  </div>
                  <div className="text-gray-400">{t.format}</div>
                </div>

                <div className="flex gap-4">
                  <Button asChild variant="outline" className="border-red-600 text-red-400 hover:bg-red-900/30">
                    <Link to={`/tournaments/${t.id}`} className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Ver Detalles
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  {t.status === 'abiertas' && (
  <Button
    onClick={() => {
      setSelectedTournament({ id: t.id, name: t.name });
      setRegisterOpen(true);
    }}
    className="bg-red-600 hover:bg-red-700"
  >
    <Plus className="h-4 w-4 mr-2" />
    Inscribirse
  </Button>
)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-20">
            <Trophy className="h-20 w-20 text-gray-700 mx-auto mb-6" />
            <p className="text-2xl text-gray-500">No hay torneos en esta categoría aún</p>
          </div>
        )}

        {selectedTournament && (
          <TournamentRegisterModal
            tournamentId={selectedTournament.id}
            tournamentName={selectedTournament.name}
            open={registerOpen}
            onOpenChange={setRegisterOpen}
          />
        )}
      </div>
    </div>
  );
};

export default TournamentsPage;