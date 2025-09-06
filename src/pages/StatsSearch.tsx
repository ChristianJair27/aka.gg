import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { Search, BarChart3 } from 'lucide-react';


import { axiosInstance } from '@/lib/axios'; // tu instancia con interceptores

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
  { value: 'na1', label: 'North America' },
  { value: 'euw1', label: 'Europe West' },
  { value: 'eun1', label: 'Europe Nordic & East' },
  { value: 'kr', label: 'Korea' },
  { value: 'br1', label: 'Brazil' },
  { value: 'la1', label: 'Latin America North' },
  { value: 'la2', label: 'Latin America South' },
  { value: 'oc1', label: 'Oceania' },
  { value: 'ru', label: 'Russia' },
  { value: 'tr1', label: 'Turkey' },
  { value: 'jp1', label: 'Japan' },
];

const StatsSearch = () => {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // ⬅️ feedback opcional

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

      // 🔗 Llamada real a tu backend
      const { data } = await axiosInstance.get<{
        puuid: string;
        gameName: string;
        tagLine: string;
      }>('/api/stats/resolve', {
        params: {
          region: form.region,   // platform (la1, la2, na1, br1, oc1, etc.)
          gameName,
          tagLine,
        },
      });

      // Navega a la página del invocador
      const encodedRiotId = encodeURIComponent(`${data.gameName}#${data.tagLine}`);
      navigate(`/stats/${form.region}/${encodedRiotId}`, {
        state: { puuid: data.puuid }, // lo usará SummonerPage
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
    <div className="min-h-screen px-4 py-12">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-6 p-4 bg-gradient-secondary rounded-lg w-fit">
            <BarChart3 className="h-12 w-12 text-secondary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Estadísticas de League of Legends
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Busca cualquier invocador y obtén estadísticas detalladas, historial de partidas y análisis de rendimiento.
          </p>
        </div>

        {/* Search Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Invocador
            </CardTitle>
            <CardDescription>
              Ingresa el Riot ID (Nombre#Tag) y selecciona la región
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="riotId" className="text-sm font-medium">
                  Riot ID
                </label>
                <Input
                  id="riotId"
                  type="text"
                  placeholder="Ejemplo: NombreInvocador#TAG"
                  {...register('riotId')}
                />
                {errors.riotId && (
                  <p className="text-sm text-destructive">{errors.riotId.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Formato: Nombre#Tag (ejemplo: Faker#KR1)
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="region" className="text-sm font-medium">
                  Región
                </label>
                <select
                  id="region"
                  className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground input-gaming focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('region')}
                >
                  {regions.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
                {errors.region && (
                  <p className="text-sm text-destructive">{errors.region.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Search className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar Estadísticas
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Popular Searches */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-6">Búsquedas Populares</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {['Faker#KR1', 'Caps#EUW', 'Doublelift#NA1', 'Perkz#EUW'].map((example) => (
              <button
                key={example}
                onClick={() => {
                  const [name, tag] = example.split('#');
                  handleSubmit((data) => onSubmit({ ...data, riotId: example }))();
                }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent/10 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSearch;