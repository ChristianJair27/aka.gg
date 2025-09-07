import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { BarChart3, Users, Trophy, Zap } from 'lucide-react';
import Contact from "@/components/Contact";

import { Search, Map, Crown, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { z } from 'zod';

import { Input } from '@/components/Input';
import { axiosInstance } from '@/lib/axios';

// Imágenes (debes reemplazar estas URLs con tus propias imágenes)
const BACKGROUND_IMAGE = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80';
const CHAMPION_IMAGE = 'https://images.unsplash.com/photo-1542751110-97427bbecf20?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1084&q=80';
const STATS_GIF = 'https://media.tenor.com/5CvY3eY9Q_0AAAAC/league-of-legends-ahri.gif';

const splitRiotId = (riotId: string) => {
  const [gameName = '', tagLine = ''] = riotId.trim().split('#');
  return { gameName, tagLine };
};

const statsSearchSchema = z.object({
  riotId: z.string().min(3, 'Riot ID debe tener al menos 3 caracteres').regex(/.+#.+/, 'Formato debe ser: Nombre#Tag'),
  region: z.string().min(1, 'Selecciona una región'),
});

type StatsSearchFormData = z.infer<typeof statsSearchSchema>;

const regions = [
  { value: 'na1', label: 'North America', icon: '🇺🇸' },
  { value: 'euw1', label: 'Europe West', icon: '🇪🇺' },
  { value: 'eun1', label: 'Europe Nordic & East', icon: '🇪🇺' },
  { value: 'kr', label: 'Korea', icon: '🇰🇷' },
  { value: 'br1', label: 'Brazil', icon: '🇧🇷' },
  { value: 'la1', label: 'Latin America North', icon: '🇲🇽' },
  { value: 'la2', label: 'Latin America South', icon: '🇦🇷' },
  { value: 'oc1', label: 'Oceania', icon: '🇦🇺' },
  { value: 'ru', label: 'Russia', icon: '🇷🇺' },
  { value: 'tr1', label: 'Turkey', icon: '🇹🇷' },
  { value: 'jp1', label: 'Japan', icon: '🇯🇵' },
];

const Home = () => {

const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StatsSearchFormData>({
    resolver: zodResolver(statsSearchSchema),
    defaultValues: {
      region: 'na1',
    },
  });

  const onSubmit = async (form: StatsSearchFormData) => {
    setIsSearching(true);
    setErrorMsg(null);

    try {
      const { gameName, tagLine } = splitRiotId(form.riotId);

      const { data } = await axiosInstance.get<{
        puuid: string;
        gameName: string;
        tagLine: string;
      }>('/api/stats/resolve', {
        params: {
          region: form.region,
          gameName,
          tagLine,
        },
      });

      const encodedRiotId = encodeURIComponent(`${data.gameName}#${data.tagLine}`);
      navigate(`/stats/${form.region}/${encodedRiotId}`, {
        state: { puuid: data.puuid },
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'No se pudo resolver el invocador. Verifica la región y el Riot ID.';
      setErrorMsg(msg);
    } finally {
      setIsSearching(false);
    }
  };






  return (
    <div className="min-h-screen bg-gradient-secondary"> {/* usa --gradient-secondary (negro) */}
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 px-4 overflow-hidden hero-gaming">
  {/* Partículas rojas */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full"
        style={{
          background: 'hsl(var(--primary))',
          opacity: 0.16,
          width: `${Math.random() * 20 + 5}px`,
          height: `${Math.random() * 20 + 5}px`,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animation: `float ${Math.random() * 15 + 10}s infinite ease-in-out`,
          animationDelay: `${Math.random() * 5}s`,
          filter: 'blur(0.5px)',
          borderRadius: '9999px',
        }}
      />
    ))}
  </div>

  <div className="container mx-auto relative z-10">
    <div className="flex flex-col lg:flex-row items-center justify-center gap-10"> {/* Cambiado a justify-center */}
      
      {/* Texto principal - ahora más ancho y centrado */}
      <div className="w-full max-w-2xl bg-gradient-to-b from-black/20 to-gray-900/20 rounded-2xl p-8 border border-red-700/30 shadow-2xl shadow-red-600/10 backdrop-blur-md"> {/* Agregados bordes y sombras */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-600/10 rounded-lg">
            <Search className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Buscar Invocador</h2>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="riotId" className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Riot ID
            </label>
            <div className="relative">
              <Input
                id="riotId"
                type="text"
                placeholder="Ejemplo: Faker#KR1"
                className="bg-black/40 border-red-700 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 pl-10 py-5"
                {...register('riotId')}
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Crown className="h-5 w-5 text-red-500" />
              </div>
            </div>
            {errors.riotId && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.riotId.message}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Formato: Nombre#Tag (ejemplo: Faker#KR1)
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="region" className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Map className="h-4 w-4" />
              Región
            </label>
            <div className="relative">
              <select
                id="region"
                className="flex h-12 w-full rounded-lg border border-red-700 bg-black/40 text-white px-10 py-2 text-sm focus:border-red-500 focus:ring-red-500/20 focus-visible:outline-none transition-colors"
                {...register('region')}
              >
                {regions.map((region) => (
                  <option key={region.value} value={region.value} className="bg-gray-900">
                    {region.icon} {region.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Map className="h-5 w-5 text-red-500" />
              </div>
            </div>
            {errors.region && (
              <p className="text-sm text-red-400">{errors.region.message}</p>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errorMsg}
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-6 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold text-lg border-none transition-all duration-300 hover:shadow-lg hover:shadow-red-600/30"
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Buscando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Buscar Estadísticas
              </>
            )}
          </Button>
        </form>
      </div>
    
      {/* Panel lateral con 3D/contacto */}
      <div className="w-full max-w-md"> {/* Contenedor para controlar el ancho del Contact */}
        <Contact />
      </div>
    </div>
  </div>

  {/* Estilos para la animación de partículas */}
  <style>
    {`
      @keyframes float {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        25% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(5deg); }
        50% { transform: translate(${Math.random() * 30 - 15}px, ${Math.random() * 30 - 15}px) rotate(0deg); }
        75% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(-5deg); }
      }
    `}
  </style>
</section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-[hsl(var(--background))]/60 backdrop-blur-sm">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Todo lo que necesitas para dominar
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Tournaments Feature */}
            <Card className="text-center bg-[hsl(var(--card))] border-[hsl(var(--border))] card-gaming">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 rounded-lg w-fit bg-gradient-primary shadow-[var(--glow-primary)]">
                  <Trophy className="h-8 w-8 text-[hsl(var(--primary-foreground))]" />
                </div>
                <CardTitle className="text-foreground">Tournaments</CardTitle>
                <CardDescription className="text-[hsl(var(--muted-foreground))]">
                  Crea y participa en torneos personalizados con brackets automáticos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/tournaments">
                  <Button
                    variant="outline"
                    className="w-full border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                  >
                    Ver Torneos
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Stats Feature */}
            <Card className="text-center bg-[hsl(var(--card))] border-[hsl(var(--border))] card-gaming">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 rounded-lg w-fit bg-gradient-primary shadow-[var(--glow-primary)]">
                  <BarChart3 className="h-8 w-8 text-[hsl(var(--primary-foreground))]" />
                </div>
                <CardTitle className="text-foreground">Stats</CardTitle>
                <CardDescription className="text-[hsl(var(--muted-foreground))]">
                  Estadísticas detalladas y análisis de rendimiento en tiempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/stats">
                  <Button
                    variant="outline"
                    className="w-full border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                  >
                    Revisar Stats
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Social Feature */}
            <Card className="text-center bg-[hsl(var(--card))] border-[hsl(var(--border))] card-gaming">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 rounded-lg w-fit bg-gradient-primary shadow-[var(--glow-primary)]">
                  <Users className="h-8 w-8 text-[hsl(var(--primary-foreground))]" />
                </div>
                <CardTitle className="text-foreground">Social</CardTitle>
                <CardDescription className="text-[hsl(var(--muted-foreground))]">
                  Conecta con tu equipo y comparte tus mejores momentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/social">
                  <Button
                    variant="outline"
                    className="w-full border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                  >
                    Únete al Chat
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-secondary border-t border-[hsl(var(--border))]">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-foreground">
            ¿Listo para llevar tu juego al siguiente nivel?
          </h2>
          <p className="text-xl text-[hsl(var(--muted-foreground))] mb-8 max-w-2xl mx-auto">
            Únete a miles de jugadores que ya están usando ATAK.GG para mejorar su experiencia competitiva.
          </p>
          <Link to="/register">
            <Button
              size="lg"
              className="btn-gaming" // usa gradiente rojo + glow
            >
              Comenzar ahora
            </Button>
          </Link>
        </div>
      </section>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(5deg); }
            50% { transform: translate(${Math.random() * 30 - 15}px, ${Math.random() * 30 - 15}px) rotate(0deg); }
            75% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(-5deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Home;
