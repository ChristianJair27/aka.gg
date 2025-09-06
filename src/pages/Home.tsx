import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { BarChart3, Users, Trophy, Zap } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-gaming py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Torneos de LoL con stats y diversión real
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Crea brackets, revisa estadísticas verificadas y comparte momentos con tu equipo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/stats">
                <Button size="lg" className="w-full sm:w-auto">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Explorar Stats
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  <Zap className="mr-2 h-5 w-5" />
                  Crear cuenta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Todo lo que necesitas para dominar
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Tournaments Feature */}
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-gradient-primary rounded-lg w-fit">
                  <Trophy className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Tournaments</CardTitle>
                <CardDescription>
                  Crea y participa en torneos personalizados con brackets automáticos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/tournaments">
                  <Button variant="outline" className="w-full">
                    Ver Torneos
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Stats Feature */}
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-gradient-secondary rounded-lg w-fit">
                  <BarChart3 className="h-8 w-8 text-secondary-foreground" />
                </div>
                <CardTitle>Stats</CardTitle>
                <CardDescription>
                  Estadísticas detalladas y análisis de rendimiento en tiempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/stats">
                  <Button variant="outline" className="w-full">
                    Revisar Stats
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Social Feature */}
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-gradient-primary rounded-lg w-fit">
                  <Users className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Social</CardTitle>
                <CardDescription>
                  Conecta con tu equipo y comparte tus mejores momentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/social">
                  <Button variant="outline" className="w-full">
                    Únete al Chat
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-hero">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            ¿Listo para llevar tu juego al siguiente nivel?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Únete a miles de jugadores que ya están usando ATAK.GG para mejorar su experiencia competitiva.
          </p>
          <Link to="/register">
            <Button size="lg">
              Comenzar ahora
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;