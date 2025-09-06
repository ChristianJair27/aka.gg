import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { Users, MessageSquare, Heart, Share2 } from 'lucide-react';

const Social = () => {
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState([
    {
      id: 1,
      user: 'ProGamer2023',
      content: '¡Acabo de subir a Diamond! La grind valió la pena 💪',
      time: 'Hace 2 horas',
      likes: 12,
      comments: 3,
    },
    {
      id: 2,
      user: 'ADCMaster',
      content: 'Buscando duo para ranked, soy ADC main. ¿Alguien que juegue support?',
      time: 'Hace 4 horas',
      likes: 7,
      comments: 8,
    },
    {
      id: 3,
      user: 'JungleKing',
      content: 'Ese momento cuando robas el Baron y ganas la partida... Best feeling ever! 🐉',
      time: 'Hace 1 día',
      likes: 25,
      comments: 5,
    },
  ]);

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    // TODO: Replace with actual API call when backend is ready
    const mockPost = {
      id: posts.length + 1,
      user: 'Mi Usuario', // Replace with actual user data
      content: newPost,
      time: 'Hace unos segundos',
      likes: 0,
      comments: 0,
    };

    setPosts([mockPost, ...posts]);
    setNewPost('');
  };

  const handleLike = (postId: number) => {
    // TODO: Replace with actual API call when backend is ready
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 p-3 bg-gradient-primary rounded-lg w-fit">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Feed Social</h1>
          <p className="text-muted-foreground">
            Comparte tus logros y conecta con la comunidad
          </p>
        </div>

        <div className="space-y-6">
          {/* Create Post */}
          <Card>
            <CardHeader>
              <CardTitle>¿Qué está pasando?</CardTitle>
              <CardDescription>Comparte tu experiencia con la comunidad</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePostSubmit} className="space-y-4">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Comparte tus logros, busca teammates, o simplemente di hola..."
                  className="w-full min-h-[120px] p-3 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground resize-none input-gaming focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {newPost.length}/280 caracteres
                  </span>
                  <Button
                    type="submit"
                    disabled={!newPost.trim() || newPost.length > 280}
                  >
                    Publicar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Posts Feed */}
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gradient-secondary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-secondary-foreground">
                        {post.user[0]}
                      </span>
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{post.user}</span>
                        <span className="text-sm text-muted-foreground">{post.time}</span>
                      </div>
                      
                      <p className="text-foreground mb-4">{post.content}</p>
                      
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => handleLike(post.id)}
                          className="flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Heart className="h-4 w-4" />
                          <span className="text-sm">{post.likes}</span>
                        </button>
                        
                        <button className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm">{post.comments}</span>
                        </button>
                        
                        <button className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {posts.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay publicaciones aún</h3>
                <p className="text-muted-foreground mb-4">
                  Sé el primero en compartir algo con la comunidad
                </p>
                <Button onClick={() => document.querySelector('textarea')?.focus()}>
                  Crear primera publicación
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Social;