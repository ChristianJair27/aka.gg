import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, Plus, Eye } from 'lucide-react';

const Tournaments = () => {
  const [tournaments] = useState([
    {
      id: 1,
      name: 'Copa ATAK.GG Verano 2024',
      status: 'Inscripciones abiertas',
      participants: 24,
      maxParticipants: 32,
      prize: '$500',
      startDate: '2024-02-15',
      format: '5v5 Single Elimination',
      description: 'Torneo oficial de la temporada de verano con premios en efectivo.',
    },
    {
      id: 2,
      name: 'Torneo de Aram Express',
      status: 'En progreso',
      participants: 16,
      maxParticipants: 16,
      prize: 'RP + Skins',
      startDate: '2024-01-20',
      format: 'ARAM Best of 3',
      description: 'Torneo rápido de ARAM para diversión y premios.',
    },
    {
      id: 3,
      name: 'Liga de Novatos',
      status: 'Finalizado',
      participants: 8,
      maxParticipants: 8,
      prize: 'Coaching gratuito',
      startDate: '2024-01-10',
      format: '1v1 Round Robin',
      description: 'Torneo especial para jugadores Bronze y Silver.',
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Inscripciones abiertas':
        return 'bg-success text-success-foreground';
      case 'En progreso':
        return 'bg-accent text-accent-foreground';
      case 'Finalizado':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleCreateTournament = () => {
    // TODO: Implement tournament creation when backend is ready
    alert('Funcionalidad de creación de torneos próximamente disponible');
  };

  const handleJoinTournament = (tournamentId: number) => {
    // TODO: Implement tournament joining when backend is ready
    alert(`Inscripción al torneo ${tournamentId} próximamente disponible`);
  };

  const handleViewTournament = (tournamentId: number) => {
    // TODO: Implement tournament details view when backend is ready
    alert(`Ver detalles del torneo ${tournamentId} próximamente disponible`);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-primary rounded-lg">
                <Trophy className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Torneos</h1>
                <p className="text-muted-foreground">
                  Compite en torneos oficiales y eventos de la comunidad
                </p>
              </div>
            </div>
          </div>
          
          <Button onClick={handleCreateTournament} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Crear Torneo
          </Button>
        </div>

        {/* Tournament Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Torneos Activos</p>
                  <p className="text-2xl font-bold">2</p>
                </div>
                <Trophy className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Participantes Total</p>
                  <p className="text-2xl font-bold">48</p>
                </div>
                <Users className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Premios Totales</p>
                  <p className="text-2xl font-bold">$500+</p>
                </div>
                <Trophy className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tournaments List */}
        <div className="space-y-6">
          {tournaments.map((tournament) => (
            <Card key={tournament.id}>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl mb-2">{tournament.name}</CardTitle>
                    <CardDescription>{tournament.description}</CardDescription>
                  </div>
                  <Badge className={getStatusColor(tournament.status)}>
                    {tournament.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {tournament.participants}/{tournament.maxParticipants} jugadores
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{tournament.prize}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(tournament.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {tournament.format}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleViewTournament(tournament.id)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Detalles
                  </Button>
                  
                  {tournament.status === 'Inscripciones abiertas' && (
                    <Button
                      onClick={() => handleJoinTournament(tournament.id)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Inscribirse
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {tournaments.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay torneos disponibles</h3>
              <p className="text-muted-foreground mb-4">
                Sé el primero en crear un torneo para la comunidad
              </p>
              <Button onClick={handleCreateTournament}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Torneo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Tournaments;