import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { useAuth } from '@/features/auth/useAuth';
import { 
  User, 
  Trophy, 
  Users, 
  BarChart3, 
  Calendar, 
  MessageSquare,
  Target,
  Award
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();

  // Mock data - replace with real API calls when backend is ready
  const mockStats = {
    totalMatches: 127,
    winRate: 68,
    currentRank: 'Diamond III',
    lp: 56,
    favoriteChampion: 'Jinx',
    tournamentsJoined: 3,
    socialPosts: 12,
  };

  const recentActivity = [
    {
      type: 'match',
      description: 'Victoria en Ranked Solo/Duo',
      time: 'Hace 2 horas',
      icon: Target,
      color: 'text-success'
    },
    {
      type: 'tournament',
      description: 'Te uniste a "Copa ATAK.GG Verano 2024"',
      time: 'Hace 1 día',
      icon: Trophy,
      color: 'text-accent'
    },
    {
      type: 'social',
      description: 'Nueva publicación en el feed social',
      time: 'Hace 2 días',
      icon: MessageSquare,
      color: 'text-secondary'
    },
  ];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            ¡Bienvenido de vuelta, {user?.name || 'Invocador'}!
          </h1>
          <p className="text-muted-foreground">
            Aquí está tu resumen de actividad y estadísticas
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Partidas Jugadas</p>
                  <p className="text-2xl font-bold">{mockStats.totalMatches}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold">{mockStats.winRate}%</p>
                </div>
                <Target className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rango Actual</p>
                  <p className="text-xl font-bold">{mockStats.currentRank}</p>
                  <p className="text-sm text-muted-foreground">{mockStats.lp} LP</p>
                </div>
                <Award className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Torneos</p>
                  <p className="text-2xl font-bold">{mockStats.tournamentsJoined}</p>
                </div>
                <Trophy className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
                <CardDescription>
                  Accede rápidamente a las funciones principales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link to="/stats" className="block">
                    <div className="p-6 rounded-lg border border-border hover:bg-accent/5 transition-colors text-center">
                      <BarChart3 className="h-8 w-8 mx-auto mb-3 text-accent" />
                      <h3 className="font-semibold mb-1">Ver Stats</h3>
                      <p className="text-sm text-muted-foreground">
                        Revisa tus estadísticas
                      </p>
                    </div>
                  </Link>
                  
                  <Link to="/tournaments" className="block">
                    <div className="p-6 rounded-lg border border-border hover:bg-accent/5 transition-colors text-center">
                      <Trophy className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-semibold mb-1">Torneos</h3>
                      <p className="text-sm text-muted-foreground">
                        Únete a competencias
                      </p>
                    </div>
                  </Link>
                  
                  <Link to="/social" className="block">
                    <div className="p-6 rounded-lg border border-border hover:bg-accent/5 transition-colors text-center">
                      <Users className="h-8 w-8 mx-auto mb-3 text-secondary" />
                      <h3 className="font-semibold mb-1">Social</h3>
                      <p className="text-sm text-muted-foreground">
                        Conecta con otros
                      </p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>
                  Tu actividad más reciente en la plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                      <div className={`p-2 rounded-lg bg-accent/10 ${activity.color}`}>
                        <activity.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Mi Perfil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-3 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary-foreground">
                      {user?.name?.[0] || 'U'}
                    </span>
                  </div>
                  <h3 className="font-semibold">{user?.name || 'Usuario'}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email || 'usuario@email.com'}</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Campeón Favorito</span>
                    <span className="text-sm font-medium">{mockStats.favoriteChampion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Publicaciones</span>
                    <span className="text-sm font-medium">{mockStats.socialPosts}</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-4">
                  Editar Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Next Tournament */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Próximo Torneo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <h3 className="font-semibold mb-1">Copa ATAK.GG</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Inicia en 3 días
                  </p>
                  <Link to="/tournaments">
                    <Button size="sm" className="w-full">
                      Ver Detalles
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;