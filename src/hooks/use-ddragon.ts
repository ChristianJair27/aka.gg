// src/hooks/use-ddragon.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

type ChampEntry = {
  key: string;   // id numérico como string (p.ej. "80")
  id: string;    // slug (p.ej. "Pantheon")
  name: string;  // nombre localizado
  image: string; // URL a la imagen de icono
};

type ChampMaps = {
  version: string;
  byKey: Record<string, ChampEntry>; // por key numérica
  byId: Record<string, ChampEntry>;  // por slug
};

export function useChampions() {
  return useQuery<ChampMaps>({
    queryKey: ["ddragon", "champions"],
    queryFn: async () => {
      // 1) última versión
      const { data: versions } = await axios.get<string[]>(
        "https://ddragon.leagueoflegends.com/api/versions.json"
      );
      const version = versions[0];

      // 2) champion.json en español (usa es_MX para LATAM)
      const { data } = await axios.get(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_MX/champion.json`
      );

      const champs = data.data as Record<string, any>;
      const byKey: ChampMaps["byKey"] = {};
      const byId: ChampMaps["byId"] = {};

      Object.values(champs).forEach((c: any) => {
        const entry: ChampEntry = {
          key: c.key,            // numérico en string
          id: c.id,              // slug
          name: c.name,          // nombre localizado
          image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png`,
        };
        byKey[c.key] = entry;
        byId[c.id] = entry;
      });

      return { version, byKey, byId };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // cache 7d
  });
}
