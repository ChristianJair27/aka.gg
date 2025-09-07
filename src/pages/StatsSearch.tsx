import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { Search, BarChart3, Map, Users, Crown, Sparkles, Trophy, Zap, Target } from 'lucide-react';

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

const StatsSearch = () => {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 px-4 py-12 relative overflow-hidden">
      {/* Imagen de fondo con overlay rojo */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>
      
      {/* Overlay rojo oscuro */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/30 via-black/70 to-red-900/30 z-0"></div>

      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-red-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-red-800/10 rounded-full blur-3xl"></div>
        
        {/* Patrón de grietas */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-1 h-48 bg-red-600 rotate-45"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-32 bg-red-600 rotate-12"></div>
          <div className="absolute bottom-1/4 left-1/3 w-1 h-40 bg-red-600 -rotate-30"></div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header con logo y título */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 rounded-full blur-md opacity-70"></div>
              <div className="relative p-5 bg-gradient-to-br from-gray-900 to-black border border-red-700/30 rounded-full shadow-2xl shadow-red-600/10 backdrop-blur-sm">
                <BarChart3 className="h-12 w-12 text-red-500" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-500 via-red-600 to-red-500 bg-clip-text text-transparent">
            Estadísticas de Invocador
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Descubre estadísticas detalladas, historial de partidas y análisis de rendimiento.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-16">
          {/* Imagen/GIF decorativa */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-red-700/30 shadow-2xl shadow-red-600/10 hidden lg:block">
            <img 
              src={CHAMPION_IMAGE} 
              alt="League of Legends Champion" 
              className="w-full h-auto object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h3 className="text-xl font-bold text-white mb-2">Domina la Grieta</h3>
              <p className="text-red-300">Analiza tus estadísticas y mejora tu juego</p>
            </div>
            
            {/* GIF pequeño en esquina */}
            <div className="absolute top-4 right-4 w-16 h-16 rounded-full overflow-hidden border-2 border-red-600">
              <img 
                src={STATS_GIF} 
                alt="Stats animation" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Search Form con efecto glass */}
          <div className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-700/30 rounded-2xl shadow-2xl shadow-red-600/10 backdrop-blur-md p-1">
            <div className="bg-gradient-to-b from-black/20 to-gray-900/20 rounded-2xl p-8">
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
          </div>
        </div>

        {/* Popular Searches */}
        <div className="text-center mb-16">
          <h2 className="text-2xl font-bold mb-6 text-white flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-red-500" />
            Búsquedas Populares
          </h2>
          <div className="flex flex-wrap gap-3 justify-center">
            {['Faker#KR1', 'Caps#EUW', 'Doublelift#NA1', 'Perkz#EUW', 'Rekkles#EUW', 'Uzi#CN'].map((example) => (
              <button
                key={example}
                onClick={() => {
                  handleSubmit((data) => onSubmit({ ...data, riotId: example }))();
                }}
                className="px-4 py-2 rounded-lg bg-gray-900/60 border border-red-700/30 text-gray-300 hover:bg-red-600/10 hover:text-white hover:border-red-500 transition-all duration-300 group"
              >
                <span className="group-hover:text-red-400 transition-colors">{example}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Información adicional con imágenes */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900/60 border border-red-700/30 rounded-xl p-5 text-center backdrop-blur-sm group hover:border-red-500 transition-all duration-300">
            <div className="inline-flex p-3 bg-red-600/10 rounded-full mb-3 group-hover:bg-red-500/20 transition-colors">
              <BarChart3 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="font-bold text-white mb-2">Estadísticas Detalladas</h3>
            <p className="text-sm text-gray-400">KDA, win rate, CS y más métricas importantes</p>
          </div>
          
          <div className="bg-gray-900/60 border border-red-700/30 rounded-xl p-5 text-center backdrop-blur-sm group hover:border-red-500 transition-all duration-300">
            <div className="inline-flex p-3 bg-red-600/10 rounded-full mb-3 group-hover:bg-red-500/20 transition-colors">
              <Trophy className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="font-bold text-white mb-2">Rendimiento Competitivo</h3>
            <p className="text-sm text-gray-400">Analiza tu desempeño en ranked y torneos</p>
          </div>
          
          <div className="bg-gray-900/60 border border-red-700/30 rounded-xl p-5 text-center backdrop-blur-sm group hover:border-red-500 transition-all duration-300">
            <div className="inline-flex p-3 bg-red-600/10 rounded-full mb-3 group-hover:bg-red-500/20 transition-colors">
              <Target className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="font-bold text-white mb-2">Compara con otros</h3>
            <p className="text-sm text-gray-400">Compara tu rendimiento con otros jugadores</p>
          </div>
        </div>

        {/* Sección de video o GIF destacado */}
        <div className="mt-16 rounded-2xl overflow-hidden border border-red-700/30 shadow-2xl shadow-red-600/10 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10"></div>
          <div className="relative z-20 p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Mejora tu juego con análisis profundos</h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-6">
              Descubre tus fortalezas, debilidades y oportunidades de mejora con nuestro sistema de análisis avanzado.
            </p>
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              Ver Ejemplo de Análisis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSearch;